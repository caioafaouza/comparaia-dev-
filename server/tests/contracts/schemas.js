const { z } = require('zod');

const healthSchema = z.object({
  status: z.string(),
  uptime: z.union([z.number(), z.string()]),
});

const authLoginSchema = z.object({
  token: z.string().min(10),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.string(),
    tenantId: z.string(),
    status: z.string(),
  }),
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    plan: z.string(),
    status: z.string(),
  }),
});

const jobSchema = z.object({
  id: z.string(),
  referenceName: z.string(),
  status: z.string(),
});

const jobsListSchema = z.object({
  jobs: z.array(jobSchema),
  total: z.number(),
});

module.exports = {
  healthSchema,
  authLoginSchema,
  jobsListSchema,
};
