# Dia do ponto

O ponto usa um período diário de 08:00:00 até antes das 08:00:00 do dia seguinte,
no horário de Brasília. A data exibida e gravada é a data em que o período começou.
Por exemplo, segunda-feira às 00h30 ainda registra o ponto de domingo; às 08h abre
o ponto de segunda. A regra de um registro por filiado por período continua valendo.

`checkinDay` é usado no envio, na situação atual, no filtro administrativo de hoje
e no limite dos períodos do ranking. `brasiliaDay` continua representando a data
civil e não foi alterado, pois também é usado pelo calendário da temporada.

A API informa o horário do servidor e a próxima renovação, permitindo que a tela
atualize às 08h sem depender do fuso/relógio local. A atualização periódica também
continua ativa. A autorização e a unicidade são sempre verificadas pelo servidor.

Os registros históricos mantêm as datas originalmente gravadas. Não há alteração
retroativa automática: mover registros antigos poderia causar colisões entre dois
pontos válidos sob a regra anterior. Ajustes históricos precisam de análise própria.
