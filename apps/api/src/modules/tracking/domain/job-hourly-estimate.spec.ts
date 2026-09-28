import { estimateJobHourlyRate } from "./job-hourly-estimate";

describe("estimateJobHourlyRate", () => {
  it("estimates hourly rate for a Mon-Fri, 8h/day job", () => {
    const result = estimateJobHourlyRate({ monthlyValue: 4000, expectedHoursPerDay: 8, weekdays: [1, 2, 3, 4, 5] });

    // 5 days * 8h * 4.345 weeks ≈ 173.8h -> 4000/173.8 ≈ 23.02
    expect(result).toBeCloseTo(23.02, 1);
  });

  it("scales down for a job worked fewer days per week", () => {
    const fiveDays = estimateJobHourlyRate({ monthlyValue: 4000, expectedHoursPerDay: 8, weekdays: [1, 2, 3, 4, 5] });
    const threeDays = estimateJobHourlyRate({ monthlyValue: 4000, expectedHoursPerDay: 8, weekdays: [1, 3, 5] });

    expect(threeDays).toBeGreaterThan(fiveDays);
  });

  it("scales down for more expected hours per day at the same monthly value", () => {
    const eightHours = estimateJobHourlyRate({ monthlyValue: 4000, expectedHoursPerDay: 8, weekdays: [1, 2, 3, 4, 5] });
    const fourHours = estimateJobHourlyRate({ monthlyValue: 4000, expectedHoursPerDay: 4, weekdays: [1, 2, 3, 4, 5] });

    expect(fourHours).toBeGreaterThan(eightHours);
  });

  it("throws for a non-positive monthly value", () => {
    expect(() => estimateJobHourlyRate({ monthlyValue: 0, expectedHoursPerDay: 8, weekdays: [1] })).toThrow();
  });

  it("throws for a non-positive expected hours per day", () => {
    expect(() => estimateJobHourlyRate({ monthlyValue: 4000, expectedHoursPerDay: 0, weekdays: [1] })).toThrow();
  });

  it("throws when no weekdays are informed", () => {
    expect(() => estimateJobHourlyRate({ monthlyValue: 4000, expectedHoursPerDay: 8, weekdays: [] })).toThrow();
  });
});
