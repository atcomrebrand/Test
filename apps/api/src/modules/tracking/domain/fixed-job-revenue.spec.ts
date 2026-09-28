import { computeFixedJobRevenue } from "./fixed-job-revenue";

describe("computeFixedJobRevenue", () => {
  it("uses the confirmed amount when one exists, ignoring the session estimate", () => {
    const result = computeFixedJobRevenue({
      jobId: "job-1",
      clientLabel: "Acme Corp",
      sessionValues: [100, 200],
      confirmedAmountBRL: 6000,
    });

    expect(result).toEqual({ jobId: "job-1", clientLabel: "Acme Corp", amount: 6000, source: "confirmed" });
  });

  it("falls back to summing session estimates when nothing is confirmed", () => {
    const result = computeFixedJobRevenue({
      jobId: "job-1",
      clientLabel: "Acme Corp",
      sessionValues: [100.555, 200.115],
      confirmedAmountBRL: null,
    });

    expect(result).toEqual({ jobId: "job-1", clientLabel: "Acme Corp", amount: 300.67, source: "estimated" });
  });

  it("returns zero for a job with no sessions and no confirmation", () => {
    const result = computeFixedJobRevenue({ jobId: "job-1", clientLabel: "Acme Corp", sessionValues: [], confirmedAmountBRL: null });

    expect(result.amount).toBe(0);
    expect(result.source).toBe("estimated");
  });

  it("rounds the confirmed amount to 2 decimal places", () => {
    const result = computeFixedJobRevenue({ jobId: "job-1", clientLabel: "Acme Corp", sessionValues: [], confirmedAmountBRL: 5999.999 });

    expect(result.amount).toBe(6000);
  });
});
