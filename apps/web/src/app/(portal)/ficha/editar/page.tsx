'use client';
import { Select } from '@/components/select';
import { Form } from '@/components/form';
import { NumberInput } from '@/components/number-input';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ContactRound,
  GraduationCap,
  AtSign,
  LockKeyhole,
  Save,
  Check,
  ArrowUpRight,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, SubmitButton, ErrorNotice, Badge, RoleInsignia } from '@/components/ui';
import { initials } from '@/lib/types';
export default function EditProfile() {
  const { data, config, mutate, notify } = usePortal();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!data || !config) return null;
  const me = data.members.find((m) => m.id === data.user.id);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = Object.fromEntries(form);
    setBusy(true);
    setError('');
    try {
      await mutate('/api/profile', 'PUT', {
        ...input,
        age: Number(input.age),
        degrees: form.getAll('degrees'),
        shareLegapp: form.has('shareLegapp'),
      });
      notify('Sua ficha foi atualizada.');
      router.push('/ficha');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title={me ? 'EDITAR MEU PERFIL.' : 'SUA TRAJETÓRIA COMEÇA AQUI.'}
        description="Atualize os dados do seu personagem e escolha o que compartilhar com os filiados."
        action={
          <Link href="/ficha" className="button secondary">
            <ArrowLeft size={16} /> Voltar ao perfil
          </Link>
        }
      />
      <div className="profile-layout">
        <aside className="profile-summary">
          <div className="profile-summary-top">
            <div className="avatar portrait">{initials(me?.name || data.user.discord)}</div>
            <h2>{me?.name || 'Seu personagem'}</h2>
            <span>{me?.blue || 'Cadastre seu @ do Blue'}</span>
            <RoleInsignia admin={data.user.admin} />
          </div>
          <div className="summary-data">
            <div>
              <small>DISCORD VINCULADO</small>
              <strong>{data.user.discord}</strong>
            </div>
            <div>
              <small>DOMICÍLIO ELEITORAL</small>
              <strong>{me?.state || 'A definir'}</strong>
            </div>
            <div>
              <small>TEMPORADA</small>
              <strong>{me?.season || 'A definir'}</strong>
            </div>
          </div>
          <p>
            <ShieldCheck size={16} /> Sua filiação é definida pelos cargos do servidor da ANADE.
          </p>
          <a
            href="https://legado.planalto.fun/wiki/personagem"
            target="_blank"
            rel="noopener noreferrer"
          >
            Regras da ficha no Legado
            <ArrowUpRight size={14} />
          </a>
        </aside>
        <Form className="profile-form" onSubmit={save}>
          <section className="panel form-section">
            <header>
              <span className="section-icon">
                <ContactRound size={18} />
              </span>
              <div>
                <h2>IDENTIDADE DO PERSONAGEM</h2>
                <p>Os dados da sua vida política no Legado.</p>
              </div>
              <Badge tone="gray">{me ? 'Cadastrada' : 'Novo cadastro'}</Badge>
            </header>
            <div className="form-grid">
              <label className="field">
                Nome e sobrenome
                <input
                  name="name"
                  defaultValue={me?.name}
                  required
                  maxLength={120}
                  placeholder="Nome do personagem"
                />
              </label>
              <label className="field">
                Temporada
                <input
                  name="season"
                  defaultValue={me?.season}
                  required
                  maxLength={120}
                  placeholder="Ex.: Temporada 1"
                />
              </label>
              <label className="field">
                Idade do personagem
                <NumberInput
                  name="age"
                  label="Idade do personagem"
                  min={18}
                  max={120}
                  defaultValue={me?.age}
                  required
                  placeholder="Idade no jogo"
                />
              </label>
              <label className="field">
                Domicílio eleitoral
                <Select
                  name="state"
                  aria-label="Estado"
                  defaultValue={me?.state || ''}
                  required
                  placeholder="Selecione o estado"
                  options={config.states.map((state) => ({ value: state, label: state }))}
                />
              </label>
              <label className="field full">
                Ideologia declarada
                <Select
                  name="ideology"
                  aria-label="Ideologia declarada"
                  defaultValue={me?.ideology || ''}
                  required
                  placeholder="Selecione a ideologia do personagem"
                  options={config.ideologies.map((ideology) => ({
                    value: ideology,
                    label: ideology,
                  }))}
                />
                <small>
                  As oito ideologias do Legado. A ideologia percebida depende das ações no jogo.
                </small>
              </label>
              <label className="field">
                Cargo atual no RPG
                <input
                  name="office"
                  maxLength={120}
                  defaultValue={me?.office}
                  placeholder="Ex.: Deputado federal"
                />
              </label>
              <label className="field">
                Profissão
                <input
                  name="profession"
                  maxLength={120}
                  defaultValue={me?.profession}
                  placeholder="Ex.: Advogado"
                />
              </label>
              <label className="field full">
                Cidade onde mora
                <input
                  name="city"
                  maxLength={120}
                  defaultValue={me?.city}
                  placeholder="Cidade do personagem"
                />
              </label>
              <label className="field full">
                Biografia
                <textarea
                  name="bio"
                  defaultValue={me?.bio}
                  maxLength={280}
                  rows={4}
                  placeholder="Conte um pouco da história do seu personagem…"
                />
                <small>Até 280 caracteres, conforme a ficha do Legado.</small>
              </label>
            </div>
          </section>
          <section className="panel form-section">
            <header>
              <span className="section-icon">
                <AtSign size={18} />
              </span>
              <div>
                <h2>CONTATOS NO LEGADO</h2>
                <p>Para manter o diálogo dentro e fora das reuniões.</p>
              </div>
            </header>
            <div className="form-grid">
              <label className="field">
                @ do Blue
                <input
                  name="blue"
                  maxLength={41}
                  defaultValue={me?.blue}
                  placeholder="@seu.personagem"
                />
              </label>
              <label className="field">
                Número do LegApp
                <input
                  name="legapp"
                  maxLength={16}
                  defaultValue={me?.legapp}
                  placeholder="(11) 423-653"
                />
                <small>DDD + seis dígitos. Use o número fictício do jogo.</small>
              </label>
              <label className="privacy-toggle full">
                <input type="checkbox" name="shareLegapp" defaultChecked={me?.shareLegapp} />
                <span>
                  <strong>Compartilhar meu LegApp com os filiados</strong>
                  <small>Desmarcado, o número fica visível apenas para você no portal.</small>
                </span>
                <LockKeyhole size={18} />
              </label>
            </div>
          </section>
          <section className="panel form-section">
            <header>
              <span className="section-icon">
                <GraduationCap size={19} />
              </span>
              <div>
                <h2>FORMAÇÃO E ATUAÇÃO</h2>
                <p>As áreas que fazem parte da sua trajetória.</p>
              </div>
            </header>
            <p className="field-hint">Selecione até duas faculdades do personagem.</p>
            <div className="degree-grid">
              {config.degrees.map((d) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    name="degrees"
                    value={d}
                    defaultChecked={me?.degrees.includes(d)}
                  />
                  <span>{d}</span>
                  <Check size={14} />
                </label>
              ))}
            </div>
            <label className="field oab-field">
              Número da OAB no RPG <small>Opcional</small>
              <input
                name="oab"
                maxLength={120}
                defaultValue={me?.oab}
                placeholder="Número da inscrição no jogo"
              />
            </label>
          </section>
          <div className="form-bottom">
            <p>
              <LockKeyhole size={15} /> Dados declarados por você. Este cadastro não altera sua
              conta no Legado.
            </p>
            <SubmitButton busy={busy}>
              <Save size={16} /> Salvar minha ficha
            </SubmitButton>
          </div>
          <ErrorNotice message={error} />
        </Form>
      </div>
    </>
  );
}
