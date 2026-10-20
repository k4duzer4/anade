-- Acrescenta abstenção às votações abertas sem alterar resultados já encerrados.
ALTER TABLE anade.poll_options DROP CONSTRAINT IF EXISTS poll_options_option_index_check;
ALTER TABLE anade.poll_options ADD CONSTRAINT poll_options_option_index_check CHECK (option_index >= 0 AND option_index <= 10);
INSERT INTO anade.poll_options(poll_id, option_index, label)
SELECT p.id, COALESCE(MAX(o.option_index), -1) + 1, 'Abstenção'
FROM anade.polls p
LEFT JOIN anade.poll_options o ON o.poll_id = p.id
LEFT JOIN anade.poll_options abstention ON abstention.poll_id = p.id AND lower(abstention.label) IN ('abstenção','abstencao')
WHERE p.closed = false AND p.deadline > now() AND abstention.poll_id IS NULL
GROUP BY p.id;
