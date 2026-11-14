# Banco de dados do IEJB Hub (Supabase)

Banco do piloto Louvor, construído a partir do [modelo de dados e permissões](../docs/planejamento/MODELO-DE-DADOS-E-PERMISSOES-PILOTO-LOUVOR.md) (v0.3) e das [regras de negócio](../docs/planejamento/REGRAS-DE-NEGOCIO-PILOTO-LOUVOR.md) (v0.6). Os comentários dentro dos arquivos citam as regras (`RN-xx`, `Qxx`) de onde cada coisa veio.

| | |
|---|---|
| Projeto Supabase | `iejb-hub` (organização IEJB Hub), região São Paulo (`sa-east-1`), Postgres 17 |
| Estado | 15 migrações (10 a 15 em 14/11/2026), a função de servidor `admin-acesso` e o bucket `fotos`. |
| Testes | 143 verificações, todas passando (`tests/local/rodar.sh`) |

## Estrutura

```
supabase/
├── migrations/          # aplicadas em ordem, nunca editadas depois de aplicadas
│   ├── ..._pessoas_e_contas.sql         # pessoa, conta, ministério, quem-sou-eu, funções de admin
│   ├── ..._grupos.sql                   # G1/G2/G3, membros, instrumento padrão por grupo
│   ├── ..._cultos.sql                   # tipos de culto, cultos, gerar_cultos()
│   ├── ..._escalas.sql                  # escala, itens, grupos usados, registro de alterações, solicitações
│   ├── ..._repertorio.sql               # músicas, repertório ordenado, quem pode editar
│   ├── ..._avisos.sql                   # avisos, central de notificações, aparelhos de push
│   ├── ..._privilegios_e_agendamento.sql# GRANTs e o pg_cron que processa avisos
│   ├── ..._dados_iniciais.sql           # Louvor, G1 a G3, cultos da semana
│   ├── ..._ajustes_do_verificador.sql   # correções apontadas pelo Supabase (ver abaixo)
│   ├── ..._gestao_de_pessoas.sql        # cadastrar_pessoa, aprovar_pedido, definir_pessoa_ativa
│   ├── ..._montar_escala_e_fotos.sql    # grupos por culto, mesa de som, rótulo (Ceia), fotos
│   ├── ..._fechar_funcoes_novas.sql     # REVOKE de anon que faltou nas 10 e 11 (ver lição abaixo)
│   ├── ..._push.sql                     # chaves VAPID, aparelhos, fila de envio, agendamento
│   ├── ..._pg_net_fora_do_public.sql    # extensão pg_net no esquema extensions
│   └── ..._lider_de_grupo_edita.sql     # D32: líder de grupo ajusta pessoas e instrumentos; líder de louvor é avisado
├── functions/enviar-push/   # entrega os avisos no celular (chamada pelo pg_cron)
├── functions/admin-acesso/  # criar acesso e redefinir senha (precisa da chave de serviço)
└── tests/local/
    ├── 00_simular_supabase.sql   # imita auth.users, auth.uid() e os papéis do Supabase
    ├── 01_ajudantes.sql          # teste.ok, teste.deve_falhar, teste.entrar
    ├── 02_cenario_piloto.sql     # o cenário completo, do primeiro admin aos avisos
    ├── 03_gestao_de_pessoas.sql  # as funções da migração 10
    ├── 04_montar_escala_e_fotos.sql # as funções da migração 11
    ├── 05_push.sql               # aparelhos e fila de envio
    ├── 06_lider_de_grupo_edita.sql # D32 (roda depois da migração 15; os anteriores, antes)
    └── rodar.sh
```

## Guia de estudo

Sugestão de ordem, do mais importante para o resto.

1. **A trava central: `privado.minha_pessoa_id()`** (migração 01). Quase toda política começa por ela. Ela só devolve alguém quando a conta está ativa, sem senha temporária e com a pessoa ativa. Entendendo essa função, você entende por que uma conta pendente não vê nada.
2. **As duas camadas: GRANT e RLS** (migração 07). O GRANT diz se o papel pode usar a tabela em geral; o RLS diz se pode usar *aquela linha*. As duas precisam deixar passar.
3. **`security definer` x `security invoker`.** Funções "definer" rodam com o poder do dono e por isso conferem o papel por dentro (`aprovar_conta`). Funções "invoker" rodam com o poder de quem chamou e deixam o RLS decidir (`preencher_escala_com_grupo`, `gerar_cultos`). Repare que toda função definer tem `set search_path = ''` e escreve `public.tabela` por extenso: é o que impede alguém de enganar a função.
4. **Escala é de pessoas** (migração 04): `escala_item` são as pessoas, `escala_grupo` são só os grupos usados como atalho. É `escala_grupo` que decide quem edita o repertório e pede alteração.
5. **Avisos sem duplicar** (migrações 04 e 06): os gatilhos só *anotam* em `escala_alteracao`. Quem transforma isso em aviso é `processar_avisos_pendentes`, rodando a cada minuto, depois de 5 minutos de silêncio (RN-45). É assim que dá para avisar quem *saiu* da escala.
6. **Truques de integridade** que valem estudar: a chave estrangeira composta `grupo_lider_e_membro` (o líder precisa estar no grupo) e a restrição `deferrable` do repertório (reordenar num único UPDATE).
7. **O cenário de testes** (`02_cenario_piloto.sql`) lê como uma história: cada bloco é um papel tentando fazer algo. É o melhor jeito de ver as regras funcionando.

## Como rodar os testes localmente

Precisa de um Postgres (16 ou mais novo). Os testes criam um banco próprio do zero.

```bash
cd supabase/tests/local
PGHOST=localhost PGPORT=5432 PGUSER=postgres ./rodar.sh
```

A saída termina com `TODOS OS TESTES PASSARAM`. Se uma regra quebrar, o teste para e mostra `FALHOU:` com o nome da regra.

## Lição aprendida: o verificador do Supabase

Depois de aplicar as 8 primeiras migrações, o verificador de segurança (*advisors*) mostrou que o Supabase dá `EXECUTE` em toda função nova direto ao papel `authenticated`. Os testes locais não pegaram porque o Postgres comum não faz isso. Resultado: `inicializar_primeiro_admin` ficou chamável por qualquer conta logada, e antes de existir admin uma conta pendente poderia se promover. O projeto estava vazio, então nada foi explorado.

Correções:
- Migração 09 tira o privilégio e faz as funções novas do `public` nascerem fechadas.
- O simulador local agora imita os privilégios padrão do Supabase, e o cenário testa esse caso.

**Regra daqui para frente:** depois de cada migração aplicada, rodar o verificador de segurança e o de desempenho. Os avisos restantes sobre as funções `aprovar_conta`, `decidir_solicitacao` etc. são intencionais: são ações do app e conferem o papel por dentro.

## Configurações do painel que faltam

Não dá para fazer por migração; precisam ser feitas no painel do Supabase antes do app ir ao ar.

| Onde | O quê | Por quê |
|---|---|---|
| Authentication → Sign In / Providers → Email | Desligar **Confirm email** | O Hub não envia e-mail (D19). Seguro só porque a conta pendente não vê nada. |
| Authentication → Rate Limits | Conferir limite de cadastros | Freia robôs na tela "pedir acesso" (DT-02). |
| Authentication → URL Configuration | Site URL `https://app.iejb.com.br` | Quando o front existir. |

## Primeiro administrador

1. Crie sua conta pelo app (ou em Authentication → Users → Add user). Ela nasce pendente.
2. No SQL Editor do Supabase, rode:
   ```sql
   select public.inicializar_primeiro_admin('seu@email', 'Kaique');
   ```
3. Só funciona uma vez. Depois disso, novos administradores são definidos por `definir_administrador`.

## O que ainda falta fora do banco

| Item | Onde | Regra |
|---|---|---|
| Criar conta com senha temporária e redefinir senha | Função de servidor (Edge Function) com a chave de serviço, chamando depois `aprovar_conta(..., true)` ou `marcar_senha_temporaria` com o token do admin | RN-10, RN-65 |
| Enviar os pushes | Edge Function que lê `aviso_destinatario` sem `push_enviado_em`, envia para `dispositivo_push` e marca o envio | D25 |
| Manter o projeto ativo e fazer backup | Tarefa agendada fora do Supabase (ex.: GitHub Actions) | DT-06, D21 |

## Função de servidor `admin-acesso`

Criar um login e trocar a senha de outra pessoa exigem a chave de serviço (`service_role`), que ignora o RLS e por isso nunca pode ir para o app. Ela só existe dentro da função, no servidor do Supabase.

A função confere quem chamou pelo token, exige conta ativa de administrador e faz as marcações no banco (`aprovar_conta`, `marcar_senha_temporaria`) **com o token de quem chamou**, então o banco confere de novo e a auditoria registra o admin certo. Publicada com `verify_jwt` desligado porque a própria função valida o token (o padrão novo de chaves do Supabase recomenda assim).

Para publicar de novo depois de mudar: `supabase functions deploy admin-acesso --no-verify-jwt` (ou pelo MCP).

## Lição aprendida 2: toda migração fecha as próprias funções

O `alter default privileges` da migração 09 só vale para funções criadas pelo papel `postgres`. Pelo painel ou pelo MCP a migração pode rodar com outro papel, e aí a função nasce aberta a `PUBLIC` (inclusive a quem não está logado). O verificador pegou `definir_foto` depois da migração 11; a 12 fechou tudo. Regra: **toda migração termina com `revoke execute ... from public, anon` das funções que criou**, mesmo confiando no padrão.

## Notificações push

1. Gatilhos anotam a mudança; `processar_avisos_pendentes` (pg_cron, a cada minuto, 5 min de silêncio) cria o aviso e os destinatários.
2. O job `enviar-push` (pg_cron + pg_net, a cada minuto) chama a função `enviar-push` **só quando tem destinatário sem push** (`privado.tem_push_pendente`).
3. A função reserva os pendentes com `reservar_pushes` (`for update skip locked`: ninguém recebe duas vezes) e entrega com a biblioteca `jsr:@negrel/webpush`. Inscrição que sumiu (410) desativa o aparelho; outro erro fica em `aviso_destinatario.push_erro`.
4. **Chaves VAPID:** a função gera na primeira chamada e guarda em `chave_push` (RLS sem política: só a chave de serviço lê). Ninguém precisou ver a chave privada. O `GET` da função devolve só a pública.

Para conferir se está entregando: `select push_enviado_em, push_erro from aviso_destinatario order by criado_em desc limit 10;`

## Backup

Semanal, criptografado, 90 dias no GitHub. Configuração e restauração (testada): [BACKUP-E-RESTAURACAO.md](BACKUP-E-RESTAURACAO.md).

## Manter acordado

O plano gratuito pausa depois de 7 dias sem uso. `.github/workflows/manter-acordado.yml` faz uma leitura por dia (GitHub Actions). Dá para rodar na hora em Actions → "Manter o Supabase acordado" → Run workflow.

## Lição aprendida 3: gatilho que pergunta "quem está agindo?" não pode ser security definer

Dentro de uma função `security definer` o `current_user` vira o dono da função, então `privado.e_sistema()` responde "sim" para todo mundo. O gatilho `mesa_so_lider_de_louvor` nasceu assim e deixava qualquer líder de grupo mexer na mesa; o teste do cenário 06 pegou antes de ir para o banco. Gatilhos que conferem o papel de quem chamou rodam como invoker (igual ao `so_admin_muda_lider` da migração 01).
