import { randomUUID } from 'node:crypto';
import { newPoll, profile } from './domain.js';
export function seed() {
  const names = [
    'Alexandre Monteiro',
    'Marina Albuquerque',
    'Gabriel Nascimento',
    'Helena Duarte',
    'Rafael Oliveira',
    'Beatriz Santos',
  ];
  const members = names.map((name, i) => ({
    ...profile({
      name,
      blue: `@${name.split(' ')[0].toLowerCase()}.anade`,
      legapp: i === 0 ? '(11) 423-653' : '',
      shareLegapp: i === 0,
      state: ['SP', 'BA', 'MG', 'RS'][i % 4],
      ideology: [
        'Trabalhismo e desenvolvimentismo',
        'Social-democracia',
        'Socialismo',
        'Liberalismo social',
      ][i % 4],
      office: ['Deputado federal', 'Sem cargo eletivo', 'Senador'][i % 3],
      profession: ['Advogado', 'Professora', 'Economista'][i % 3],
      city: ['São Paulo', 'Salvador', 'Belo Horizonte', 'Porto Alegre'][i % 4],
      season: 'Temporada 1',
      age: 30 + i * 3,
      degrees: [['Direito'], ['Medicina'], ['Economia'], ['Ciência Política']][i % 4],
      bio: 'Personagem fictício para demonstração do portal da ANADE.',
    }),
    id: i === 0 ? 'demo-admin' : `demo-${i}`,
    discord: `${name.split(' ')[0].toLowerCase()}_demo`,
    joinedAt: new Date().toISOString(),
  }));
  const ahead = (days) => new Date(Date.now() + days * 86400000).toISOString();
  const meetings = [
    {
      id: randomUUID(),
      title: 'Reunião do Diretório Nacional',
      date: ahead(1),
      location: 'Google Meet',
      meetUrl: '',
      docsUrl: '',
      agenda: [
        'Prioridades da bancada para a temporada',
        'Organização dos diretórios estaduais',
        'Encaminhamentos e próximos passos',
      ],
      minutes: '',
      attendance: ['demo-1', 'demo-2', 'demo-3'],
    },
    {
      id: randomUUID(),
      title: 'Encontro de formação política',
      date: ahead(3),
      location: 'Google Meet',
      meetUrl: '',
      docsUrl: '',
      agenda: [
        'O funcionamento do Congresso no Legado',
        'Ideologia declarada e atuação parlamentar',
      ],
      minutes: '',
      attendance: ['demo-1'],
    },
  ];
  const polls = [
    newPoll(
      {
        title: 'Prioridades para a atuação da bancada',
        description: 'Qual pauta deve orientar o primeiro ciclo de propostas da ANADE?',
        options: [
          'Trabalho e ensino técnico',
          'Justiça tributária',
          'Desenvolvimento com inclusão',
        ],
        deadline: ahead(2),
        secret: true,
      },
      'demo-admin',
    ),
    newPoll(
      {
        title: 'Formato dos encontros de formação',
        description: 'Escolha como vamos organizar os encontros dos filiados.',
        options: ['Encontros quinzenais', 'Encontros mensais'],
        deadline: ahead(4),
        secret: false,
      },
      'demo-admin',
    ),
  ];
  polls[0].votes = { 'demo-1': 0, 'demo-2': 1, 'demo-3': 0 };
  polls[1].votes = { 'demo-1': 0, 'demo-2': 1 };
  const directors = [
    {
      id: randomUUID(),
      memberId: 'demo-admin',
      title: 'Presidência nacional',
      responsibility: 'Coordenação política da aliança e representação do diretório nacional.',
      position: 1,
    },
    {
      id: randomUUID(),
      memberId: 'demo-1',
      title: 'Secretaria de organização',
      responsibility: 'Articulação dos diretórios e acolhimento dos filiados.',
      position: 2,
    },
    {
      id: randomUUID(),
      memberId: 'demo-2',
      title: 'Secretaria de formação',
      responsibility: 'Formação política, debates e construção do programa partidário.',
      position: 3,
    },
  ];
  return { members, meetings, polls, directors };
}
