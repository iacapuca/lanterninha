// Fictional demo content: reviewer handles, films and review texts (pt-BR, user-facing).
export const USERNAMES = [
  'pipoqueira',
  'fileira_g',
  'cinefilo_da_augusta',
  'lanterna_vermelha',
  'cinema_novo_sempre',
  'tela_grande',
  'meia_entrada',
  'sessao_das_dez',
  'creditos_finais',
  'joao_do_centro',
  'mari_no_escurinho',
  'nao_fala_no_cinema',
  'super8',
  'trilha_sonora',
  'balde_de_pipoca',
]

export const FILMS = [
  'Ainda Estou Aqui',
  'O Agente Secreto',
  'Bacurau',
  'Central do Brasil',
  'Cidade de Deus',
  'Duna: Parte Dois',
  'Oppenheimer',
  'Interestelar',
  'Aquarius',
  'Que Horas Ela Volta?',
  'O Auto da Compadecida 2',
  'Mad Max: Estrada da Fúria',
  'Retrato de uma Jovem em Chamas',
  'Marte Um',
]

// Review bodies are user content, so they are pt-BR.
export const BODIES: Record<'high' | 'mid' | 'low', string[]> = {
  high: [
    'Imagem impecável, preto de verdade e som que você sente no peito. Vale cada centavo do ingresso.',
    'Uma das melhores salas que já frequentei. Poltronas confortáveis e o público respeita o filme.',
    'Saí arrepiado. A projeção estava perfeitamente calibrada e o som envolve sem estourar.',
    'Sala histórica muito bem cuidada. Ver filme aqui é programa completo.',
    'Escolhi a fileira do meio e a experiência foi absurda. Volto com certeza.',
  ],
  mid: [
    'Boa sala, mas o ar-condicionado estava gelado demais. Leve um casaco.',
    'Imagem ok, som um pouco baixo nos diálogos. Nada que estrague a sessão.',
    'Poltrona razoável, limpeza poderia ser melhor. Pelo preço, cumpre o que promete.',
    'Experiência correta. Os trailers duraram uns 25 minutos, o que cansa.',
    'Gostei da tela, mas as fileiras da frente ficam desconfortáveis para o pescoço.',
  ],
  low: [
    'Projeção escura e fora de foco no canto da tela. Reclamei e ninguém resolveu.',
    'Som estourado e chão grudando. Não volto tão cedo.',
    'Poltrona quebrada e muita conversa durante o filme. Faltou um lanterninha de verdade!',
    'Caro para o que entrega. A sala precisa de uma reforma urgente.',
  ],
}
