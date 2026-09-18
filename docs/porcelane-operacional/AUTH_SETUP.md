# Porcelane — configuração de acesso

## 1. Criar usuário
No Supabase: Authentication → Users → Add user → Create new user.

Use o e-mail do administrador e uma senha forte.

## 2. Vincular perfil
Depois de criar o usuário, copie o UUID do usuário e execute no SQL Editor:

```sql
update public.profiles
set nome = 'Administrador', role = 'admin', ativo = true
where id = 'UUID_DO_USUARIO';
```

O campo correto do perfil é `role`.

Não use a `service_role` key no navegador.

## 3. Primeiro acesso
Abra o Porcelane pelo Bolt/publicação atual. O sistema deve apresentar a tela de acesso. Entre com o usuário criado no Supabase.

## 4. Perfis disponíveis
- admin
- vendas
- tecnico
- pcp
- financeiro
- rh
- instalacao
- cliente

## 5. Regra de transição
Nesta fase o RLS operacional antigo continua preservado para não interromper a operação. Depois de validar o login, o acesso às tabelas será endurecido por perfil.

## 6. Segurança do perfil
O usuário autenticado pode consultar apenas o próprio perfil. A alteração de `role` e `ativo` não fica liberada pelo navegador; essas alterações devem ser feitas por administração controlada.
