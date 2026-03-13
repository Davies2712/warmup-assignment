// HELPERS
// Parse "hh:mm:ss am/pm" to total seconds from midnight
function parseTimeToSeconds(timeStr) {
  timeStr = timeStr.trim().toLowerCase();
  const parts = timeStr.split(" ");
  const period = parts[1];
  const timeParts = parts[0].split(":");
  let hours = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1]);
  const seconds = parseInt(timeParts[2]);

  if (period === "am") {
    if (hours === 12) hours = 0;
  } else {
    if (hours !== 12) hours += 12;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

// Parse "h:mm:ss" or "hhh:mm:ss" duration to total seconds
function parseDurationToSeconds(durationStr) {
  durationStr = durationStr.trim();
  const parts = durationStr.split(":");
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
}

// Convert seconds to "h:mm:ss" (no padding on hours)
function secondsToDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Convert seconds to "hhh:mm:ss" (3-digit zero-padded hours)
function secondsToLongDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const fs = require("fs");

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    // TODO: Implement this function
  const startSec = parseTimeToSeconds(startTime);
  let endSec = parseTimeToSeconds(endTime);
  if (endSec < startSec) endSec += 24 * 3600;
  return secondsToDuration(endSec - startSec);
}

}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
  const startSec = parseTimeToSeconds(startTime);
  const endSec = parseTimeToSeconds(endTime);

  const deliveryStart = 8 * 3600;  // 8:00:00 AM
  const deliveryEnd = 22 * 3600;   // 10:00:00 PM

  let idleSec = 0;

  // Idle before delivery hours start
  if (startSec < deliveryStart) {
    idleSec += Math.min(endSec, deliveryStart) - startSec;
  }

  // Idle after delivery hours end
  if (endSec > deliveryEnd) {
    idleSec += endSec - Math.max(startSec, deliveryEnd);
  }

  return secondsToDuration(idleSec);
}


// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
  const shiftSec = parseDurationToSeconds(shiftDuration);
  const idleSec = parseDurationToSeconds(idleTime);
  return secondsToDuration(shiftSec - idleSec);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
  const activeSec = parseDurationToSeconds(activeTime);

  const parts = date.split("-");
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  // Eid al-Fitr period: April 10–30, 2025 → reduced quota of 6 hours
  const isEid = year === 2025 && month === 4 && day >= 10 && day <= 30;
  const quotaSec = isEid ? 6 * 3600 : 8 * 3600 + 24 * 60;

  return activeSec >= quotaSec;
}
// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
  const { driverID, driverName, date, startTime, endTime } = shiftObj;

  let lines = [];
  try {
    const content = fs.readFileSync(textFile, "utf8");
    lines = content.split("\n").filter((line) => line.trim() !== "");
  } catch (e) {
    // File doesn't exist yet — start empty
  }

  // Reject duplicate (same driverID + date already exists)
  for (const line of lines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID && cols[2].trim() === date) {
      return {};
    }
  }

  // Compute derived fields
  const shiftDuration = getShiftDuration(startTime, endTime);
  const idleTime = getIdleTime(startTime, endTime);
  const activeTime = getActiveTime(shiftDuration, idleTime);
  const quota = metQuota(date, activeTime);
  const hasBonus = false;

  const newEntry = `${driverID},${driverName},${date},${startTime},${endTime},${shiftDuration},${idleTime},${activeTime},${quota},${hasBonus}`;

  // Insert after last record of this driverID, or append at end
  let lastIndexOfDriver = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].split(",")[0].trim() === driverID) {
      lastIndexOfDriver = i;
    }
  }

  if (lastIndexOfDriver === -1) {
    lines.push(newEntry);
  } else {
    lines.splice(lastIndexOfDriver + 1, 0, newEntry);
  }

  fs.writeFileSync(textFile, lines.join("\n") + "\n", "utf8");

  return {
    driverID,
    driverName,
    date,
    startTime,
    endTime,
    shiftDuration,
    idleTime,
    activeTime,
    metQuota: quota,
    hasBonus,
  };
}


// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n");

  const updatedLines = lines.map((line) => {
    if (line.trim() === "") return line;
    const cols = line.split(",");
    if (cols[0].trim() === driverID && cols[2].trim() === date) {
      cols[9] = newValue.toString();
      return cols.join(",");
    }
    return line;
  });

  fs.writeFileSync(textFile, updatedLines.join("\n"), "utf8");
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  const targetMonth = parseInt(month); // normalises "04" and "4" to the same number

  let driverExists = false;
  let count = 0;

  for (const line of lines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      driverExists = true;
      const recordMonth = parseInt(cols[2].trim().split("-")[1]);
      if (recordMonth === targetMonth) {
        if (cols[9].trim().toLowerCase() === "true") count++;
      }
    }
  }

  return driverExists ? count : -1;
}


// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  const targetMonth = parseInt(month);
  let totalSec = 0;

  for (const line of lines) {
    const cols = line.split(",");
    if (cols[0].trim() === driverID) {
      const recordMonth = parseInt(cols[2].trim().split("-")[1]);
      if (recordMonth === targetMonth) {
        totalSec += parseDurationToSeconds(cols[7].trim());
      }
    }
  }

  return secondsToLongDuration(totalSec);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
