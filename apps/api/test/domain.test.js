import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newPoll,
  castVote,
  presentPoll,
  profile,
  publicMember,
  meetingLink,
  meetingDetails,
} from '../src/domain.js';
const sample = {
  name: 'Maria Silva',
  state: 'BA',
  ideology: 'Centro',
  season: 'Temporada 1',
  age: 35,
  degrees: ['Direito'],
  legapp: '(11) 423-653',
};
test('links da reunião aceitam apenas chamadas Meet e documentos Google Docs por HTTPS', () => {
  assert.equal(
    meetingLink('https://meet.google.com/abc-defg-hij', 'meet', true),
    'https://meet.google.com/abc-defg-hij',
  );
  assert.equal(
    meetingLink('https://docs.google.com/document/d/example/edit?usp=sharing', 'docs'),
    'https://docs.google.com/document/d/example/edit?usp=sharing',
  );
  assert.equal(meetingLink('', 'docs'), '');
  for (const link of [
    'javascript:alert(1)',
    'http://meet.google.com/abc-defg-hij',
    'https://meet.google.com.evil.test/abc-defg-hij',
    'https://meet.google.com@evil.test/abc-defg-hij',
    'https://meet.google.com/new',
  ])
    assert.throws(() => meetingLink(link, 'meet', true));
  assert.throws(() => meetingLink('https://docs.google.com/spreadsheets/d/example/edit', 'docs'));
  assert.throws(() => meetingLink('https://evil.test/document/d/example/edit', 'docs'));
  const input = {
    title: 'Reunião',
    date: new Date(Date.now() - 60000).toISOString(),
    agenda: ['Pauta'],
    meetUrl: 'https://meet.google.com/abc-defg-hij',
  };
  assert.throws(() => meetingDetails(input, { creating: true }), /futura/);
  assert.equal(meetingDetails(input).docsUrl, '');
});
test('LegApp segue DDD + seis dígitos fictícios; portabilidade entre estados é aceita', () => {
  assert.equal(profile(sample).legapp, '(11) 423-653');
  for (const legapp of ['11999999999', '(21) 423-653', '(11) 123-456'])
    assert.throws(() => profile({ ...sample, legapp }));
  assert.throws(() => profile({ ...sample, degrees: ['Direito', 'Economia', 'Administração'] }));
  assert.throws(() => profile({ ...sample, state: 'RJ' }));
  assert.throws(() => profile({ ...sample, ideology: 'Inventada' }));
});
test('LegApp privado fica oculto inclusive para outros dirigentes', () => {
  const member = { ...profile(sample), id: 'u1' };
  assert.equal(publicMember(member, 'u1').legapp, '(11) 423-653');
  assert.equal(publicMember(member, 'u2').legapp, undefined);
  assert.equal(publicMember({ ...member, shareLegapp: true }, 'u2').legapp, '(11) 423-653');
});
test('votação secreta não expõe votos nominais ou resultado parcial', () => {
  const poll = newPoll(
    {
      title: 'Tema',
      options: ['A', 'B'],
      deadline: new Date(Date.now() + 60000).toISOString(),
      secret: true,
    },
    'admin',
  );
  castVote(poll, 'u1', 1);
  const view = presentPoll(poll, 'u2');
  assert.equal(view.votes, undefined);
  assert.equal(view.ballots, undefined);
  assert.equal(view.counts, undefined);
  assert.equal(view.myVote, null);
  assert.equal(presentPoll(poll, 'u1').myVote, 1);
  assert.throws(() => castVote(poll, 'u1', 0), /já foi registrado/);
  assert.throws(() => castVote(poll, 'u2', 8), /inválida/);
  poll.closed = true;
  assert.deepEqual(presentPoll(poll, 'u2').counts, [0, 1, 0]);
  assert.equal(presentPoll(poll, 'u2').ballots, undefined);
  assert.throws(() => castVote(poll, 'u2', 0), /encerrada/);
});
test('abstenção é única, conta como participação e preserva sigilo e voto definitivo', () => {
  const poll = newPoll(
    {
      title: 'Tema',
      options: ['Sim', 'Não', 'abstencao'],
      secret: true,
      deadline: new Date(Date.now() + 60000).toISOString(),
    },
    'admin',
  );
  assert.deepEqual(poll.options, ['Sim', 'Não', 'Abstenção']);
  castVote(poll, 'u1', 2);
  let view = presentPoll(poll, 'u2');
  assert.equal(view.total, 1);
  assert.equal(view.abstentions, undefined);
  assert.equal(view.validVotes, undefined);
  assert.throws(() => castVote(poll, 'u1', 0), /já foi registrado/);
  poll.closed = true;
  view = presentPoll(poll, 'u2');
  assert.equal(view.abstentions, 1);
  assert.equal(view.validVotes, 0);
  assert.deepEqual(view.counts, [0, 0, 1]);
  assert.equal(view.ballots, undefined);
});
test('votação nominal identifica votos e prazo encerra automaticamente', () => {
  assert.throws(() => newPoll({ options: 'inválido' }, 'admin'), /lista de alternativas/);
  const poll = newPoll(
    { title: 'Tema', options: ['A', 'B'], deadline: new Date(Date.now() + 60000).toISOString() },
    'admin',
  );
  castVote(poll, 'u1', 0);
  assert.deepEqual(presentPoll(poll, 'u2').ballots, [{ id: 'u1', option: 0 }]);
  poll.deadline = new Date(Date.now() - 1).toISOString();
  assert.equal(presentPoll(poll, 'u2').closed, true);
  assert.throws(() => castVote(poll, 'u2', 1), /encerrada/);
});
