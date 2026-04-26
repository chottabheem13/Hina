const SHIFT_DEFINITIONS = [
  {
    id: "shift-1",
    label: "Shift 1",
    startLabel: "09:00",
    endLabel: "12:00",
    durationMinutes: 180,
    primaryByDay: {
      monday: "Sharon",
      tuesday: "Abi",
      wednesday: "Abi",
      thursday: "Sharon",
      friday: "Abi",
      saturday: "Sharon",
      sunday: null,
    },
  },
  {
    id: "shift-2",
    label: "Shift 2",
    startLabel: "12:00",
    endLabel: "15:00",
    durationMinutes: 180,
    primaryByDay: {
      monday: "Abi",
      tuesday: "Cilla",
      wednesday: "Sharon",
      thursday: "Abi",
      friday: "Cilla",
      saturday: "Abi",
      sunday: null,
    },
  },
  {
    id: "shift-3",
    label: "Shift 3",
    startLabel: "15:00",
    endLabel: "18:00",
    durationMinutes: 180,
    primaryByDay: {
      monday: "Cilla",
      tuesday: "Sharon",
      wednesday: "Cilla",
      thursday: "Cilla",
      friday: "Sharon",
      saturday: "Cilla",
      sunday: null,
    },
  },
];

function getShiftScheduleSummary() {
  return SHIFT_DEFINITIONS.map((shift) => `${shift.label} (${shift.startLabel}-${shift.endLabel})`).join(", ");
}

module.exports = {
  SHIFT_DEFINITIONS,
  getShiftScheduleSummary,
};
