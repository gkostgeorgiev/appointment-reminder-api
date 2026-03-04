export const getDateRange = (
  range: "today" | "week" | "month",
): { rangeStart: Date; rangeEnd: Date } => {
  const now = new Date();

  switch (range) {
    case "today": {
      const rangeStart = new Date(now);
      rangeStart.setUTCHours(0, 0, 0, 0);

      const rangeEnd = new Date(now);
      rangeEnd.setUTCHours(23, 59, 59, 999);

      return { rangeStart, rangeEnd };
    }

    case "week": {
      const day = now.getUTCDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;

      const rangeStart = new Date(now);
      rangeStart.setUTCDate(now.getUTCDate() + diffToMonday);
      rangeStart.setUTCHours(0, 0, 0, 0);

      const rangeEnd = new Date(rangeStart);
      rangeEnd.setUTCDate(rangeStart.getUTCDate() + 6);
      rangeEnd.setUTCHours(23, 59, 59, 999);

      return { rangeStart, rangeEnd };
    }

    case "month": {
      const rangeStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );

      const rangeEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
      );
      rangeEnd.setUTCHours(23, 59, 59, 999);

      return { rangeStart, rangeEnd };
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
};

export const getEndOfDay = (date: Date) => {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
};

export const getAppointmentEnd = (start: Date, duration: number) => {
  return new Date(start.getTime() + duration * 60000);
};
