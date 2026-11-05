# Acervo de comunicação

Página interna `/materiais`, disponível no menu Participação. Filiados consultam,
buscam, filtram por categoria, visualizam imagens e baixam os arquivos originais.
Somente administradores publicam arquivos, editam título/descrição/categoria e
excluem materiais com confirmação. Convidados recebem a página vazia habitual e
não acessam nenhuma das APIs ou arquivos.

Categorias: logos e identidade, panfletos, redes sociais, apresentações e outros.
Formatos: PNG, JPG, WebP estáticos ou PDF, até 4 MB por arquivo. O backend identifica
o formato pelos bytes e decodifica as imagens antes de aceitar. O original é
preservado, incluindo transparência e resolução. PDFs têm validação de cabeçalho
e terminador; não há promessa de análise antivírus. PDFs são sempre anexos para
download, sem execução ou incorporação ao portal. SVGs, vídeos e ZIPs não são aceitos.

Metadados na migração `021_materials.sql` com RLS habilitada e privilégios públicos
revogados. Arquivos no bucket privado `anade-materials` do Supabase Storage, usando
as mesmas credenciais do backend já configuradas. O bucket é preparado sob demanda
e uma configuração pública é recusada. Nenhuma chave vai para o navegador.

Rotas autenticadas:

- `GET /api/materials?category=&search=&page=0`: páginas de 18 materiais.
- `POST /api/materials`: ADM, multipart com `file`, `title`, `description`, `category`.
- `PUT /api/materials/:id`: ADM, altera apenas metadados.
- `DELETE /api/materials/:id`: ADM, retira metadados e tenta remover o objeto privado.
- `GET /api/materials/:id/file`: original como anexo. `?preview=1` exibe apenas imagens.

Os arquivos passam pela autorização do servidor em cada leitura, sem URLs públicas
ou caminhos do bucket expostos. Downloads usam `no-store`, `nosniff` e política de
conteúdo restrita. Alterações exigem origem e CSRF e herdam os limites de uploads.
Falhas de gravação tentam remover o objeto recém-criado; falhas de limpeza geram
logs `MATERIAL_*_CLEANUP_FAILED` para acompanhamento. Após exclusão, a rota do
arquivo retorna 404 mesmo se a limpeza física precisar de intervenção.

O acervo começa vazio. Os materiais usados na prévia visual são fixtures locais
com artes do repositório e não foram publicados nem criados no banco de produção.
