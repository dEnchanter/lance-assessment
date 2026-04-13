import Decimal from "../../utils/decimal";

describe("Decimal utility", () => {
  describe("add", () => {
    it("adds two positive amounts", () => {
      expect(Decimal.add("100.00", "50.25")).toBe("150.25");
    });

    it("adds zero", () => {
      expect(Decimal.add("500.00", "0.00")).toBe("500.00");
    });

    it("handles large numbers", () => {
      expect(Decimal.add("999999999999.99", "0.01")).toBe("1000000000000.00");
    });

    it("handles cents-only values", () => {
      expect(Decimal.add("0.50", "0.50")).toBe("1.00");
    });
  });

  describe("subtract", () => {
    it("subtracts two positive amounts", () => {
      expect(Decimal.subtract("100.00", "30.50")).toBe("69.50");
    });

    it("subtracts to zero", () => {
      expect(Decimal.subtract("100.00", "100.00")).toBe("0.00");
    });

    it("produces negative result when subtracting larger from smaller", () => {
      expect(Decimal.subtract("50.00", "100.00")).toBe("-50.00");
    });

    it("subtracts zero", () => {
      expect(Decimal.subtract("250.75", "0.00")).toBe("250.75");
    });
  });

  describe("lessThan", () => {
    it("returns true when first is less", () => {
      expect(Decimal.lessThan("50.00", "100.00")).toBe(true);
    });

    it("returns false when first is greater", () => {
      expect(Decimal.lessThan("100.00", "50.00")).toBe(false);
    });

    it("returns false when equal", () => {
      expect(Decimal.lessThan("100.00", "100.00")).toBe(false);
    });

    it("compares cents correctly", () => {
      expect(Decimal.lessThan("100.01", "100.02")).toBe(true);
      expect(Decimal.lessThan("100.02", "100.01")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles values without decimal point", () => {
      expect(Decimal.add("100", "50")).toBe("150.00");
    });

    it("handles single decimal digit", () => {
      expect(Decimal.add("10.5", "20.3")).toBe("30.80");
    });

    it("chained operations maintain precision", () => {
      // Simulate deposit then transfer: 0 + 1000 - 250 = 750
      let balance = "0.00";
      balance = Decimal.add(balance, "1000.00");
      balance = Decimal.subtract(balance, "250.00");
      expect(balance).toBe("750.00");
    });

    it("many small additions don't lose precision", () => {
      // 0.01 * 100 should equal 1.00 exactly
      let balance = "0.00";
      for (let i = 0; i < 100; i++) {
        balance = Decimal.add(balance, "0.01");
      }
      expect(balance).toBe("1.00");
    });
  });
});
