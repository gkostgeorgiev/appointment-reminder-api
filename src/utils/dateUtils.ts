export const getDateRange = (
  range: "today" | "week" | "month"
): { start: Date; end: Date } => {
  const now = new Date();

  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);

      const end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);

      return { start, end };
    }

    case "week": {
      const day = now.getUTCDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;

      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() + diffToMonday);
      start.setUTCHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);

      return { start, end };
    }

    case "month": {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      );

      const end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
      );
      end.setUTCHours(23, 59, 59, 999);

      return { start, end };
    }

    default: {
      const _exhaustiveCheck: never = range;
      throw new Error(`Unhandled range: ${_exhaustiveCheck}`);
    }
  }
};

export const getStartOfDay = (date: Date) => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export const getEndOfDay = (date: Date) => {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}