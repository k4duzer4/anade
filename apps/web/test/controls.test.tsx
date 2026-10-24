import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { Select } from '../src/components/select';
import { DateTimePicker } from '../src/components/date-time-picker';
import { Form } from '../src/components/form';
import { Modal } from '../src/components/ui';
import { Tooltip } from '../src/components/floating-ui';
import { NumberInput } from '../src/components/number-input';

const options = [
  { value: 'true', label: 'Voto secreto' },
  { value: 'false', label: 'Voto nominal (aberto)' },
];

describe('controles ANADE', () => {
  it('campo numérico respeita limites, permite digitação e valida antes de enviar', async () => {
    const user = userEvent.setup();
    const saved = vi.fn((event) => event.preventDefault());
    render(
      <Form aria-label="Diretor" onSubmit={saved}>
        <NumberInput name="position" label="Ordem" min={1} max={3} defaultValue={1} required />
        <button type="submit">Salvar</button>
      </Form>,
    );
    expect(
      (screen.getByRole('button', { name: 'Diminuir ordem' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Aumentar ordem' }));
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('position')).toBe('2');
    await user.click(screen.getByRole('button', { name: 'Aumentar ordem' }));
    expect(
      (screen.getByRole('button', { name: 'Aumentar ordem' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '8');
    await user.click(screen.getByText('Salvar'));
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('até 3');
    await user.clear(input);
    await user.type(input, '2');
    await user.click(screen.getByText('Salvar'));
    expect(saved).toHaveBeenCalledOnce();
  });
  it('select mantém FormData, seleção por teclado e devolve o foco ao fechar', async () => {
    const user = userEvent.setup();
    render(
      <Form aria-label="Votação">
        <label>
          Modalidade
          <Select name="secret" aria-label="Modalidade" defaultValue="true" options={options} />
        </label>
      </Form>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Modalidade' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.keyboard('{End}{Enter}');
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('secret')).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await user.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('campos obrigatórios usam aviso ANADE e impedem envio até uma opção ser escolhida', async () => {
    const user = userEvent.setup();
    const saved = vi.fn((event) => event.preventDefault());
    render(
      <Form onSubmit={saved}>
        <label>
          Estado
          <Select
            name="state"
            aria-label="Estado"
            required
            options={[{ value: 'BA', label: 'Bahia' }]}
          />
        </label>
        <button type="submit">Salvar</button>
      </Form>,
    );
    await user.click(screen.getByText('Salvar'));
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Preencha este campo');
    const trigger = screen.getByRole('combobox', { name: 'Estado' });
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(trigger);
    await user.keyboard('{ArrowDown}{Enter}');
    await user.click(screen.getByText('Salvar'));
    expect(saved).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calendário preserva data/hora local, cancela rascunho e aplica dia e minutos exatos', async () => {
    const user = userEvent.setup();
    render(
      <Form aria-label="Reunião">
        <DateTimePicker
          name="date"
          label="Data da reunião"
          defaultValue="2026-10-20T23:37"
          required
        />
      </Form>,
    );
    const form = screen.getByRole('form') as HTMLFormElement;
    const trigger = screen.getByRole('button', { name: 'Data da reunião' });
    expect(new FormData(form).get('date')).toBe('2026-10-20T23:37');
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: /21 de outubro de 2026/i }));
    await user.keyboard('{Escape}');
    expect(new FormData(form).get('date')).toBe('2026-10-20T23:37');
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: /21 de outubro de 2026/i }));
    const hour = screen.getByRole('combobox', { name: 'Hora' });
    hour.focus();
    await user.keyboard('{ArrowDown}{Home}{Enter}');
    expect(screen.getByRole('dialog', { name: 'Selecionar data da reunião' })).toBeTruthy();
    const minute = screen.getByRole('combobox', { name: 'Minuto' });
    minute.focus();
    await user.keyboard('{ArrowDown}{Home}{ArrowDown}{Enter}');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(new FormData(form).get('date')).toBe('2026-10-21T00:01');
    expect(new Date(String(new FormData(form).get('date'))).toISOString()).toBe(
      '2026-10-21T03:01:00.000Z',
    );
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(new FormData(form).get('date')).toBe('');
  }, 15000); // Calendar + nested keyboard selects require several complete DOM renders in JSDOM.

  it('calendário vazio obrigatório bloqueia envio e botões internos não enviam o formulário', async () => {
    const user = userEvent.setup();
    const saved = vi.fn((event) => event.preventDefault());
    render(
      <Form onSubmit={saved}>
        <DateTimePicker name="date" label="Data" required />
        <button type="submit">Publicar</button>
      </Form>,
    );
    await user.click(screen.getByText('Publicar'));
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Data' }));
    await user.click(screen.getByRole('button', { name: 'Hoje' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(saved).not.toHaveBeenCalled();
    await user.click(screen.getByText('Publicar'));
    expect(saved).toHaveBeenCalledOnce();
  });

  it('popups ficam dentro do dialog nativo e Escape fecha apenas o select', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <TooltipProvider>
        <Modal title="Nova reunião" onClose={close}>
          <Form>
            <DateTimePicker name="date" label="Data" defaultValue="2026-10-20T19:00" />
            <Select aria-label="Modalidade" options={options} />
          </Form>
        </Modal>
      </TooltipProvider>,
    );
    const modal = screen.getByRole('dialog', { name: 'Nova reunião' });
    const trigger = screen.getByRole('combobox', { name: 'Modalidade' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(modal.contains(screen.getByRole('listbox'))).toBe(true);
    await user.keyboard('{Escape}');
    expect(close).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Data' }));
    expect(modal.contains(screen.getByRole('dialog', { name: 'Selecionar data' }))).toBe(true);
  });

  it('tooltips têm apresentação própria e aparecem por foco de teclado', async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="Modo escuro">
          <button aria-label="Tema">Lua</button>
        </Tooltip>
      </TooltipProvider>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Tema' }));
    expect(await screen.findByRole('tooltip')).toBeTruthy();
    expect(screen.getByRole('button').hasAttribute('title')).toBe(false);
  });

  it('filtro controlado pode retornar à opção Todos', async () => {
    function Filter() {
      const [value, setValue] = useState('all');
      return (
        <Select
          aria-label="Estado"
          value={value}
          onValueChange={setValue}
          options={[
            { value: 'all', label: 'Todos os estados' },
            { value: 'BA', label: 'Bahia' },
          ]}
        />
      );
    }
    const user = userEvent.setup();
    render(<Filter />);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{ArrowDown}{End}{Enter}');
    expect(trigger.textContent).toContain('Bahia');
    await user.keyboard('{ArrowDown}{Home}{Enter}');
    expect(trigger.textContent).toContain('Todos os estados');
  });
});
