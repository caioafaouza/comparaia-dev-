
# Compara IA / VendasPRO - Backend Multi-Tenant

Este diretório contém a implementação da arquitetura **Database-per-Tenant**.

## Estrutura

- **`db/connectionManager.js`**: O coração do sistema. Gerencia um pool de conexões MySQL. Ele mantém uma conexão persistente com o banco `Master` e cria conexões sob demanda para os bancos dos `Tenants`. Implementa cache e timeout para fechar conexões inativas.
- **`middleware/tenantResolver.js`**: Intercepta cada requisição HTTP. Descobre qual é a empresa acessando (via subdomínio ou header), busca as credenciais no Master e injeta o objeto `req.db` (Knex) já conectado ao banco correto.
- **`services/provisioningService.js`**: Automação de DevOps via código. Quando um cliente se cadastra, este serviço cria um banco de dados SQL físico, um usuário SQL com permissões restritas e roda as migrations iniciais.

## Fluxo de Dados

1. **Request**: `POST http://loja-apple.comparaia.com/api/v1/products`
2. **Resolver**: 
   - Extrai slug: `loja-apple`.
   - Consulta Master DB: `SELECT * FROM tenants WHERE slug = 'loja-apple'`.
   - Retorna credenciais do banco `vendaspro_tenant_a1b2`.
3. **Connection Factory**:
   - Verifica se já existe conexão aberta para `vendaspro_tenant_a1b2`.
   - Se não, abre conexão e cacheia.
4. **Controller**:
   - Recebe `req.db`.
   - Executa `req.db('products').select(...)`.
   - A query roda estritamente dentro do banco `vendaspro_tenant_a1b2`.

## Migrations

Para rodar migrations em todos os tenants (manutenção):

```bash
# Exemplo de script de manutenção (não incluído por brevidade)
# Iteraria sobre todos os tenants do master e executaria:
knex migrate:latest --env tenant_config
```
