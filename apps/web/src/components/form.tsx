'use client';

import { useContext, useId, useState, type ComponentProps, type SubmitEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CircleAlert, X } from 'lucide-react';
import { FloatingLayerContext } from './floating-ui';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
function validationMessage(control: Control) {
  const validity = control.validity;
  if (validity.customError) return control.validationMessage;
  if (validity.valueMissing) return 'Preencha este campo para continuar.';
  if (validity.badInput) return 'Informe um número válido.';
  if (validity.typeMismatch)
    return control.type === 'url'
      ? 'Informe um link completo, começando com https://.'
      : 'Confira o formato deste campo.';
  if (validity.rangeUnderflow)
    return `Informe um valor a partir de ${control.getAttribute('min')}.`;
  if (validity.rangeOverflow) return `Informe um valor até ${control.getAttribute('max')}.`;
  if (validity.stepMismatch) return 'Confira o intervalo permitido para este valor.';
  if (validity.tooShort) return `Use pelo menos ${control.getAttribute('minlength')} caracteres.`;
  if (validity.tooLong) return `Use no máximo ${control.getAttribute('maxlength')} caracteres.`;
  if (validity.patternMismatch)
    return control.name === 'discordId'
      ? 'Use um ID Discord com 17 a 20 dígitos.'
      : 'Confira o formato solicitado para este campo.';
  return control.validationMessage || 'Confira este campo antes de continuar.';
}

export function Form({ onSubmit, children, ...props }: ComponentProps<'form'>) {
  const container = useContext(FloatingLayerContext);
  const id = useId();
  const [feedback, setFeedback] = useState<{ anchor: HTMLElement; message: string } | null>(null);
  function clear() {
    if (feedback) {
      feedback.anchor.removeAttribute('aria-invalid');
      feedback.anchor.removeAttribute('aria-errormessage');
    }
    setFeedback(null);
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    clear();
    const invalid = Array.from(event.currentTarget.elements).find(
      (element) =>
        (element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement) &&
        element.willValidate &&
        !element.validity.valid,
    ) as Control | undefined;
    if (!invalid) return onSubmit?.(event);
    event.preventDefault();
    const anchor =
      invalid
        .closest('[data-form-control]')
        ?.querySelector<HTMLElement>('[data-control-trigger]') || invalid;
    anchor.setAttribute('aria-invalid', 'true');
    anchor.setAttribute('aria-errormessage', id);
    anchor.focus();
    setFeedback({ anchor, message: validationMessage(invalid) });
  }
  return (
    <form
      {...props}
      noValidate
      onSubmit={submit}
      onInput={(event) => {
        clear();
        props.onInput?.(event);
      }}
      onChange={(event) => {
        clear();
        props.onChange?.(event);
      }}
    >
      {children}
      <Popover.Root
        open={!!feedback}
        onOpenChange={(next) => {
          if (!next) clear();
        }}
      >
        <Popover.Anchor
          virtualRef={{
            current: feedback?.anchor || { getBoundingClientRect: () => new DOMRect() },
          }}
        />
        <Popover.Portal container={container}>
          <Popover.Content
            className="anade-validation-popover"
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            aria-label="Confira este campo"
          >
            <CircleAlert size={18} />
            <p id={id} role="alert">
              {feedback?.message}
            </p>
            <Popover.Close aria-label="Fechar aviso">
              <X size={14} />
            </Popover.Close>
            <Popover.Arrow className="anade-validation-arrow" width={12} height={6} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </form>
  );
}
