import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { AnkabotLicenseRepository } from './repository.js';
import { createLicenseSchema, updateLicenseSchema, licenseIdSchema, licenseFiltersSchema } from './validation.js';

export function registerAnkabotLicenseRoutes(app: FastifyInstance, pool: Pool, key: string) {
  const repository = new AnkabotLicenseRepository(pool, key);
  const path = '/api/ankabot-licenses';
  app.post(path, async (request, reply) => {
    const license = await repository.create(createLicenseSchema.parse(request.body));
    return reply.code(201).send(license);
  });
  app.get(path, request => repository.list(licenseFiltersSchema.parse(request.query)));
  app.get(`${path}/:id`, request => repository.get(licenseIdSchema.parse(request.params).id));
  app.patch(`${path}/:id`, request => repository.update(licenseIdSchema.parse(request.params).id,
    updateLicenseSchema.parse(request.body)));
  app.delete(`${path}/:id`, async (request, reply) => {
    await repository.delete(licenseIdSchema.parse(request.params).id);
    return reply.code(204).send();
  });
}
