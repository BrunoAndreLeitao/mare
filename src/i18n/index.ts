import { type BoardType } from '../db/types';

// Strings de UI em pt-PT (CLAUDE.md): todo o texto visível vive aqui, nunca
// hardcoded nos componentes. Um futuro 'en' troca este objeto, não a
// infraestrutura — daí zero bibliotecas.
export const t = {
  tabs: {
    sessions: 'Sessões',
    spots: 'Spots',
    profile: 'Perfil',
  },
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    archive: 'Arquivar',
    required: 'Obrigatório',
    genericError: 'Algo correu mal. Tenta de novo.',
  },
  profile: {
    placeholder: 'Quiver e definições chegam em breve.',
  },
  sessions: {
    emptyTitle: 'Sem sessões',
    emptyBody: 'O registo de sessões chega na próxima fase.',
  },
  spots: {
    listTitle: 'Spots',
    newTitle: 'Novo spot',
    editTitle: 'Editar spot',
    empty: 'Ainda não tens spots. Cria o primeiro para poderes registar sessões.',
    create: 'Criar spot',
    name: 'Nome',
    namePlaceholder: 'Carcavelos',
    latitude: 'Latitude',
    longitude: 'Longitude',
    notes: 'Notas',
    notesPlaceholder: 'Fundo, acessos, avisos pessoais…',
    useMyLocation: 'Usar a minha localização',
    locationDenied: 'Permissão de localização recusada. Introduz as coordenadas manualmente.',
    locationFailed: 'Não foi possível obter a localização. Tenta de novo ou introduz manualmente.',
    coordsOutOfRange: 'Coordenadas fora do intervalo válido (lat −90…90, lon −180…180).',
    coordsNullIsland: '(0, 0) fica no meio do Atlântico — confirma as coordenadas.',
    coordsNotNumeric: 'Latitude e longitude têm de ser números.',
    archiveConfirm: 'Arquivar este spot? As sessões dele mantêm-se no histórico.',
  },
  boards: {
    sectionTitle: 'Quiver',
    newTitle: 'Nova prancha',
    editTitle: 'Editar prancha',
    empty: 'Sem pranchas no quiver.',
    create: 'Adicionar prancha',
    name: 'Nome',
    namePlaceholder: "6'2 Lost Driver",
    type: 'Tipo',
    volume: 'Volume (L)',
    archiveConfirm: 'Arquivar esta prancha? As sessões dela mantêm-se no histórico.',
    types: {
      shortboard: 'Shortboard',
      fish: 'Fish',
      funboard: 'Funboard',
      longboard: 'Longboard',
      gun: 'Gun',
      foam: 'Esponja',
      other: 'Outra',
    } satisfies Record<BoardType, string>,
  },
} as const;
