export const calculateCurrentStepsStreak = (stepsData: any[]) => {
  if (!stepsData || stepsData.length === 0) {
    return 0;
  }

  const validStreakDays = stepsData.filter(step => step.steps >= 2000);

  if (validStreakDays.length === 0) {
    return 0;
  }

  const sortedSteps = validStreakDays.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getDateString = (date: Date | string) => {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const now = new Date();
  const todayStr = getDateString(now);

  const yesterdayDate = new Date(now);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayStr = getDateString(yesterdayDate);

  const mostRecentDateStr = getDateString(sortedSteps[0].date);

  let startOffset = 0;
  let streakActive = true;

  if (mostRecentDateStr === todayStr) {
    startOffset = 0;
  } else if (mostRecentDateStr === yesterdayStr) {
    startOffset = 1;
  } else {
    streakActive = false;
  }

  if (!streakActive) {
    return 0;
  }

  let currentStreak = 0;

  for (let i = 0; i < sortedSteps.length; i++) {
    const stepDateStr = getDateString(sortedSteps[i].date);

    const expectedDate = new Date(now);
    expectedDate.setUTCDate(expectedDate.getUTCDate() - (startOffset + i));
    const expectedDateStr = getDateString(expectedDate);

    if (stepDateStr === expectedDateStr) {
      currentStreak++;
    } else {
      break;
    }
  }

  return currentStreak;
};
