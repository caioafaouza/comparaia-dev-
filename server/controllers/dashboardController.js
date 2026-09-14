const connectionManager = require('../db/connectionManager');
const billingService = require('../services/billingService');

const HOURS_SAVED_PER_COMPLETED_JOB = Number(process.env.DASHBOARD_HOURS_SAVED_PER_JOB || 2);
const HOURLY_ENGINEERING_VALUE_BRL = Number(process.env.DASHBOARD_ENGINEERING_HOURLY_VALUE || 500);

const mapRecentJob = (req, job) => ({
  id: job.id,
  tenantId: req.tenant?.id,
  userId: job.user_id,
  status: job.status,
  referenceName: job.reference_name,
  candidateCount: job.candidate_count,
  createdAt: job.created_at,
  completedAt: job.completed_at,
  cost: parseFloat(job.cost || 0),
  result: job.result,
  error: job.error_message,
});

const getMetrics = async (req, res) => {
  try {
    const db = req.db;

    const hasSales = await db.schema.hasTable('sales');
    const hasJobs = await db.schema.hasTable('comparison_jobs');

    const usersCount = await db('users').count('id as count').first();
    const usersUsed = parseInt(usersCount?.count || 0, 10);

    const masterDb = connectionManager.getMaster();
    const plan = await billingService.getPlanById(masterDb, req.tenant?.plan);
    const usersTotal = plan?.limits?.maxUsers || Math.max(1, usersUsed);
    const storageTotal = plan?.limits?.maxStorageGB || 0;

    const defaultMetrics = {
      revenue: 0,
      profit: 0,
      totalJobs: 0,
      totalCandidatesAnalyzed: 0,
      estimatedHoursSaved: 0,
      estimatedMoneySaved: 0,
      abcCurve: [],
      resourceUsage: {
        users: { used: usersUsed, total: usersTotal },
        storage: { usedGB: 0, totalGB: storageTotal },
      },
      recentJobs: [],
      trends: { moneySaved: 0, hoursSaved: 0 },
      topSuppliers: [],
    };

    let jobMetrics = { count: 0, candidates: 0 };
    let recentJobs = [];
    if (hasJobs) {
      const jobs = await db('comparison_jobs')
        .select('candidate_count')
        .where({ status: 'COMPLETED' });
      jobMetrics.count = jobs.length;
      jobMetrics.candidates = jobs.reduce((acc, j) => acc + (j.candidate_count || 0), 0);
      recentJobs = await db('comparison_jobs').select('*').orderBy('created_at', 'desc').limit(5);
    }

    const estimatedHoursSaved = jobMetrics.count * HOURS_SAVED_PER_COMPLETED_JOB;
    const estimatedMoneySaved = estimatedHoursSaved * HOURLY_ENGINEERING_VALUE_BRL;
    const trends = {
      moneySaved: estimatedMoneySaved,
      hoursSaved: estimatedHoursSaved,
    };

    if (!hasSales) {

      return res.json({
        ...defaultMetrics,
        totalJobs: jobMetrics.count,
        totalCandidatesAnalyzed: jobMetrics.candidates,
        estimatedHoursSaved,
        estimatedMoneySaved,
        trends,
        metricsSource: {
          totalJobs: 'comparison_jobs.status=COMPLETED',
          totalCandidatesAnalyzed: 'SUM(comparison_jobs.candidate_count) where status=COMPLETED',
          estimatedHoursSaved: `${HOURS_SAVED_PER_COMPLETED_JOB}h por job concluído`,
          estimatedMoneySaved: `${HOURLY_ENGINEERING_VALUE_BRL} BRL por hora * estimatedHoursSaved`,
        },
        recentJobs: recentJobs.map((job) => mapRecentJob(req, job)),
      });
    }

    const financialSummary = await db('sales')
      .select(
        db.raw('SUM(total_amount) as total_revenue'),
        db.raw('SUM(total_amount - total_cost) as total_profit'),
      )
      .first();

    const totalRevenueResult = await db('sales_items').sum('subtotal as total');
    const totalRevenue = totalRevenueResult[0].total || 1;

    const productsABC = await db('products')
      .leftJoin('sales_items', 'products.id', 'sales_items.product_id')
      .select(
        'products.name',
        db.raw('SUM(sales_items.subtotal) as revenue'),
        db.raw('(SUM(sales_items.subtotal) / ?) * 100 as percentage', [totalRevenue]),
      )
      .groupBy('products.id')
      .orderBy('revenue', 'desc');

    res.json({
      ...defaultMetrics,
      revenue: financialSummary?.total_revenue || 0,
      profit: financialSummary?.total_profit || 0,
      totalJobs: jobMetrics.count,
      totalCandidatesAnalyzed: jobMetrics.candidates,
      estimatedHoursSaved,
      estimatedMoneySaved,
      trends,
      metricsSource: {
        totalJobs: 'comparison_jobs.status=COMPLETED',
        totalCandidatesAnalyzed: 'SUM(comparison_jobs.candidate_count) where status=COMPLETED',
        estimatedHoursSaved: `${HOURS_SAVED_PER_COMPLETED_JOB}h por job concluído`,
        estimatedMoneySaved: `${HOURLY_ENGINEERING_VALUE_BRL} BRL por hora * estimatedHoursSaved`,
      },
      abcCurve: productsABC,
      recentJobs: recentJobs.map((job) => mapRecentJob(req, job)),
    });
  } catch (error) {
    console.warn('[Dashboard] Error:', error.message);
    res.json({
      revenue: 0,
      profit: 0,
      totalJobs: 0,
      totalCandidatesAnalyzed: 0,
      estimatedHoursSaved: 0,
      estimatedMoneySaved: 0,
      abcCurve: [],
      resourceUsage: { users: { used: 0, total: 1 }, storage: { usedGB: 0, totalGB: 0 } },
      recentJobs: [],
      trends: { moneySaved: 0, hoursSaved: 0 },
      topSuppliers: [],
    });
  }
};

module.exports = { getMetrics };
