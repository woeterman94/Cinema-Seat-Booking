import React, { useEffect, useMemo, useState } from "react";

const colors = ["blue", "purple", "yellow", "green", "red", "indigo", "pink"];

const defaultGuestCredits = [
  {
    id: "guest-1",
    fullName: "Alex Johnson",
    maxSeats: 2,
    allowedTypes: ["regular", "premium"],
  },
  {
    id: "guest-2",
    fullName: "Jamie Smith",
    maxSeats: 1,
    allowedTypes: ["vip"],
  },
];

const rowLabel = (row) => String.fromCharCode(65 + row);

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "movie-night";

const isFullName = (value) =>
  value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 1).length >= 2;

const toRowIndex = (token) => {
  const trimmed = token.trim().toUpperCase();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const code = trimmed.charCodeAt(0) - 65;
  return code >= 0 ? code : null;
};

const parseRowsInput = (value, totalRows) => {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return [];

  const rows = new Set();

  for (const token of tokens) {
    if (token.includes("-")) {
      const [startRaw, endRaw] = token.split("-");
      const start = toRowIndex(startRaw);
      const end = toRowIndex(endRaw);

      if (start === null || end === null) return null;

      const from = Math.min(start, end);
      const to = Math.max(start, end);

      for (let current = from; current <= to; current += 1) {
        if (current < 0 || current >= totalRows) return null;
        rows.add(current);
      }
    } else {
      const row = toRowIndex(token);
      if (row === null || row < 0 || row >= totalRows) return null;
      rows.add(row);
    }
  }

  return [...rows].sort((left, right) => left - right);
};

const formatRows = (rows) => rows.map((row) => rowLabel(row)).join(", ");

const buildSeatInventory = (layout) => {
  const seatIds = [];

  for (let row = 0; row < layout.rows; row += 1) {
    for (let seat = 1; seat <= layout.seatsPerRow; seat += 1) {
      seatIds.push(`${rowLabel(row)}${seat}`);
    }
  }

  return seatIds;
};

const getSeatMeta = (seatId) => {
  const match = /^([A-Z])(\d+)$/.exec(seatId);
  if (!match) return null;

  return {
    row: match[1].charCodeAt(0) - 65,
    seat: Number(match[2]) - 1,
  };
};

const getColorClass = (color) => {
  const map = {
    blue: "bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200",
    purple: "bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200",
    yellow: "bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200",
    green: "bg-green-100 border-green-300 text-green-800 hover:bg-green-200",
    red: "bg-red-100 border-red-300 text-red-800 hover:bg-red-200",
    indigo: "bg-indigo-100 border-indigo-300 text-indigo-800 hover:bg-indigo-200",
    pink: "bg-pink-100 border-pink-300 text-pink-800 hover:bg-pink-200",
  };

  return map[color] || map.blue;
};

const getSeatClassName = (seat) => {
  const base =
    "w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 m-1 rounded-t-lg border-2 transition-all duration-200 flex items-center justify-center text-xs sm:text-sm font-bold";

  if (seat.status === "booked") {
    return `${base} bg-gray-400 border-gray-500 text-gray-600 cursor-not-allowed`;
  }

  if (seat.selected) {
    return `${base} bg-green-500 border-green-600 text-white transform scale-110`;
  }

  return `${base} cursor-pointer ${getColorClass(seat.color)}`;
};

const normalizeSeatIds = (value) =>
  [...new Set(value.toUpperCase().split(/[\s,]+/).filter(Boolean))];

const isValidSeatId = (seatId, layout) => {
  const meta = getSeatMeta(seatId);
  return (
    meta &&
    meta.row >= 0 &&
    meta.row < layout.rows &&
    meta.seat >= 0 &&
    meta.seat < layout.seatsPerRow
  );
};

const sanitizeLayout = (layout) => ({
  rows: Number(layout.rows),
  seatsPerRow: Number(layout.seatsPerRow),
  aislePosition: Number(layout.aislePosition),
});

const CinemaSeatBooking = ({
  layout = { rows: 8, seatsPerRow: 12, aislePosition: 5 },
  seatTypes = {
    regular: { name: "Regular", price: 150, rows: [0, 1, 2] },
    premium: { name: "Premium", price: 250, rows: [3, 4, 5] },
    vip: { name: "VIP", price: 350, rows: [6, 7] },
  },
  bookedSeats = [],
  currency = "₹",
  onBookingComplete = () => {},
  title = "Cinema Hall Booking",
  subtitle = "Select your preferred seats",
}) => {
  const initialSeatTypes = useMemo(
    () =>
      Object.entries(seatTypes).map(([type, config], index) => ({
        type,
        name: config.name,
        price: Number(config.price),
        rows: config.rows,
        rowsInput: formatRows(config.rows),
        color: colors[index % colors.length],
      })),
    [seatTypes]
  );

  const [view, setView] = useState("booking");
  const [movieName, setMovieName] = useState(title);
  const [movieSubtitle, setMovieSubtitle] = useState(subtitle);
  const [sessionSlug, setSessionSlug] = useState(slugify(title));
  const [seatLayout, setSeatLayout] = useState(sanitizeLayout(layout));
  const [seatTypeConfigs, setSeatTypeConfigs] = useState(initialSeatTypes);
  const [layoutDraft, setLayoutDraft] = useState(sanitizeLayout(layout));
  const [seatTypeDrafts, setSeatTypeDrafts] = useState(initialSeatTypes);
  const [wizardStep, setWizardStep] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [completedBooking, setCompletedBooking] = useState(null);
  const [bookingMessage, setBookingMessage] = useState(null);
  const [adminMessage, setAdminMessage] = useState(null);
  const [guestCredits, setGuestCredits] = useState(defaultGuestCredits);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingSeats, setEditingSeats] = useState("");
  const [bookings, setBookings] = useState(() =>
    bookedSeats.map((seatId, index) => ({
      id: `seed-${index}-${seatId}`,
      name: "Existing booking",
      seatIds: [seatId],
      totalPrice: 0,
      createdAt: new Date().toISOString(),
    }))
  );

  const parsedSeatTypes = useMemo(() => {
    const parsed = seatTypeConfigs.map((config, index) => ({
      ...config,
      color: colors[index % colors.length],
    }));

    return parsed.length > 0 ? parsed : initialSeatTypes;
  }, [initialSeatTypes, seatTypeConfigs]);

  const getSeatType = (row) => {
    const match = parsedSeatTypes.find((config) => config.rows.includes(row));
    return match || parsedSeatTypes[0];
  };

  const getSeatPrice = (seatId) => {
    const meta = getSeatMeta(seatId);
    if (!meta) return 0;
    return getSeatType(meta.row)?.price || 0;
  };

  useEffect(() => {
    setBookings((currentBookings) =>
      currentBookings.map((booking) => ({
        ...booking,
        totalPrice: booking.seatIds.reduce(
          (total, seatId) => total + getSeatPrice(seatId),
          0
        ),
      }))
    );
  }, [parsedSeatTypes, seatLayout]);

  const bookedSeatIds = useMemo(
    () => bookings.flatMap((booking) => booking.seatIds),
    [bookings]
  );

  const bookedSeatIdSet = useMemo(() => new Set(bookedSeatIds), [bookedSeatIds]);

  const selectedSeatTypeSummary = useMemo(
    () =>
      selectedSeatIds.map((seatId) => {
        const meta = getSeatMeta(seatId);
        const seatType = meta ? getSeatType(meta.row) : parsedSeatTypes[0];
        return { seatId, seatType };
      }),
    [parsedSeatTypes, selectedSeatIds]
  );

  const currentGuestRule =
    guestCredits.find(
      (credit) =>
        credit.fullName.trim().toLowerCase() === guestName.trim().toLowerCase()
    ) || {
      fullName: "Guest pass",
      maxSeats: 2,
      allowedTypes: parsedSeatTypes.map((config) => config.type),
    };

  const totalPrice = selectedSeatIds.reduce(
    (total, seatId) => total + getSeatPrice(seatId),
    0
  );

  const seatGrid = useMemo(() => {
    const grid = [];

    for (let row = 0; row < seatLayout.rows; row += 1) {
      const rowSeats = [];
      const seatType = getSeatType(row);

      for (let seat = 0; seat < seatLayout.seatsPerRow; seat += 1) {
        const seatId = `${rowLabel(row)}${seat + 1}`;
        rowSeats.push({
          id: seatId,
          row,
          seat,
          type: seatType.type,
          price: seatType.price,
          color: seatType.color,
          status: bookedSeatIdSet.has(seatId) ? "booked" : "available",
          selected: selectedSeatIds.includes(seatId),
        });
      }

      grid.push(rowSeats);
    }

    return grid;
  }, [bookedSeatIdSet, parsedSeatTypes, seatLayout, selectedSeatIds]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `?event=${sessionSlug}`;
    const url = new URL(window.location.href);
    url.searchParams.set("event", sessionSlug);
    return url.toString();
  }, [sessionSlug]);

  const resetWizard = () => {
    setWizardStep(1);
    setGuestName("");
    setSelectedSeatIds([]);
    setCompletedBooking(null);
    setBookingMessage(null);
  };

  const handleContinueFromName = () => {
    if (!isFullName(guestName)) {
      setBookingMessage({
        type: "error",
        text: "Please enter your full name before continuing.",
      });
      return;
    }

    setBookingMessage(null);
    setWizardStep(2);
  };

  const handleSeatClick = (seat) => {
    if (seat.status === "booked") return;

    const alreadySelected = selectedSeatIds.includes(seat.id);

    if (!alreadySelected) {
      if (!currentGuestRule.allowedTypes.includes(seat.type)) {
        setBookingMessage({
          type: "error",
          text: `${currentGuestRule.fullName} can only book ${currentGuestRule.allowedTypes
            .map(
              (type) =>
                parsedSeatTypes.find((config) => config.type === type)?.name || type
            )
            .join(", ")} seats.`,
        });
        return;
      }

      if (selectedSeatIds.length >= currentGuestRule.maxSeats) {
        setBookingMessage({
          type: "error",
          text: `This guest pass allows up to ${currentGuestRule.maxSeats} seat(s).`,
        });
        return;
      }
    }

    setSelectedSeatIds((current) =>
      alreadySelected
        ? current.filter((seatId) => seatId !== seat.id)
        : [...current, seat.id]
    );
    setBookingMessage(null);
  };

  const handleContinueFromSeats = () => {
    if (selectedSeatIds.length === 0) {
      setBookingMessage({
        type: "error",
        text: "Select at least one seat to continue.",
      });
      return;
    }

    setBookingMessage(null);
    setWizardStep(3);
  };

  const handleConfirmBooking = () => {
    if (!isFullName(guestName) || selectedSeatIds.length === 0) return;

    const booking = {
      id: `${Date.now()}`,
      name: guestName.trim(),
      seatIds: [...selectedSeatIds].sort(),
      totalPrice,
      createdAt: new Date().toISOString(),
    };

    setBookings((current) => [...current, booking]);
    setCompletedBooking(booking);
    setSelectedSeatIds([]);
    setBookingMessage({
      type: "success",
      text: `Booked ${booking.seatIds.join(", ")} for ${booking.name}.`,
    });
    onBookingComplete(booking);
  };

  const handleSaveMovie = () => {
    const trimmedName = movieName.trim();
    const trimmedSubtitle = movieSubtitle.trim();
    const nextSlug = slugify(sessionSlug || movieName);

    if (!trimmedName || !trimmedSubtitle) {
      setAdminMessage({
        type: "error",
        text: "Movie name and subtitle are required.",
      });
      return;
    }

    setMovieName(trimmedName);
    setMovieSubtitle(trimmedSubtitle);
    setSessionSlug(nextSlug);
    setAdminMessage({
      type: "success",
      text: "Movie details updated.",
    });
  };

  const handleSaveLayout = () => {
    const nextLayout = sanitizeLayout(layoutDraft);

    if (
      Number.isNaN(nextLayout.rows) ||
      Number.isNaN(nextLayout.seatsPerRow) ||
      Number.isNaN(nextLayout.aislePosition) ||
      nextLayout.rows < 1 ||
      nextLayout.seatsPerRow < 1 ||
      nextLayout.aislePosition < 0 ||
      nextLayout.aislePosition > nextLayout.seatsPerRow
    ) {
      setAdminMessage({
        type: "error",
        text: "Enter a valid theatre layout.",
      });
      return;
    }

    const parsedDrafts = [];

    for (const draft of seatTypeDrafts) {
      const parsedRows = parseRowsInput(draft.rowsInput, nextLayout.rows);
      if (parsedRows === null) {
        setAdminMessage({
          type: "error",
          text: `Rows for ${draft.name} are invalid. Use formats like A-C or A, B.`,
        });
        return;
      }

      parsedDrafts.push({
        ...draft,
        name: draft.name.trim(),
        price: Number(draft.price),
        rows: parsedRows,
      });
    }

    if (parsedDrafts.some((draft) => !draft.name || Number.isNaN(draft.price))) {
      setAdminMessage({
        type: "error",
        text: "Each seat category needs a name and price.",
      });
      return;
    }

    const validSeatIds = new Set(buildSeatInventory(nextLayout));
    if (bookedSeatIds.some((seatId) => !validSeatIds.has(seatId))) {
      setAdminMessage({
        type: "error",
        text: "Move or clear bookings before shrinking the theatre layout.",
      });
      return;
    }

    setSeatLayout(nextLayout);
    setSeatTypeConfigs(parsedDrafts);
    setSeatTypeDrafts(
      parsedDrafts.map((draft, index) => ({
        ...draft,
        color: colors[index % colors.length],
        rowsInput: formatRows(draft.rows),
      }))
    );
    setSelectedSeatIds((current) =>
      current.filter((seatId) => validSeatIds.has(seatId))
    );
    setAdminMessage({
      type: "success",
      text: "Theatre layout updated.",
    });
  };

  const handleAddGuestCredit = () => {
    setGuestCredits((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        fullName: "",
        maxSeats: 1,
        allowedTypes: parsedSeatTypes.map((config) => config.type),
      },
    ]);
  };

  const handleUpdateGuestCredit = (id, field, value) => {
    setGuestCredits((current) =>
      current.map((credit) =>
        credit.id === id ? { ...credit, [field]: value } : credit
      )
    );
  };

  const handleToggleAllowedType = (id, type) => {
    setGuestCredits((current) =>
      current.map((credit) => {
        if (credit.id !== id) return credit;

        const allowedTypes = credit.allowedTypes.includes(type)
          ? credit.allowedTypes.filter((currentType) => currentType !== type)
          : [...credit.allowedTypes, type];

        return { ...credit, allowedTypes };
      })
    );
  };

  const handleRemoveGuestCredit = (id) => {
    setGuestCredits((current) => current.filter((credit) => credit.id !== id));
  };

  const handleStartEditingBooking = (booking) => {
    setEditingBookingId(booking.id);
    setEditingName(booking.name);
    setEditingSeats(booking.seatIds.join(", "));
  };

  const handleSaveBookingEdit = () => {
    const nextSeatIds = normalizeSeatIds(editingSeats);

    if (!isFullName(editingName)) {
      setAdminMessage({
        type: "error",
        text: "Bookings must include a full name.",
      });
      return;
    }

    if (nextSeatIds.length === 0) {
      setAdminMessage({
        type: "error",
        text: "Bookings need at least one seat.",
      });
      return;
    }

    if (nextSeatIds.some((seatId) => !isValidSeatId(seatId, seatLayout))) {
      setAdminMessage({
        type: "error",
        text: "One or more seat IDs are invalid for the current layout.",
      });
      return;
    }

    const occupiedSeatIds = new Set(
      bookings
        .filter((booking) => booking.id !== editingBookingId)
        .flatMap((booking) => booking.seatIds)
    );

    if (nextSeatIds.some((seatId) => occupiedSeatIds.has(seatId))) {
      setAdminMessage({
        type: "error",
        text: "One or more seats are already assigned to another booking.",
      });
      return;
    }

    setBookings((current) =>
      current.map((booking) =>
        booking.id === editingBookingId
          ? {
              ...booking,
              name: editingName.trim(),
              seatIds: nextSeatIds.sort(),
              totalPrice: nextSeatIds.reduce(
                (total, seatId) => total + getSeatPrice(seatId),
                0
              ),
            }
          : booking
      )
    );
    setEditingBookingId(null);
    setEditingName("");
    setEditingSeats("");
    setAdminMessage({
      type: "success",
      text: "Booking updated.",
    });
  };

  const handleDeleteBooking = (id) => {
    setBookings((current) => current.filter((booking) => booking.id !== id));
    if (editingBookingId === id) {
      setEditingBookingId(null);
      setEditingName("");
      setEditingSeats("");
    }
    setAdminMessage({
      type: "success",
      text: "Booking cleared.",
    });
  };

  const handleClearAllBookings = () => {
    setBookings([]);
    setEditingBookingId(null);
    setEditingName("");
    setEditingSeats("");
    setAdminMessage({
      type: "success",
      text: "All bookings cleared.",
    });
  };

  const renderSeatSection = (seatRow, start, end) => (
    <div className="flex">
      {seatRow.slice(start, end).map((seat, index) => (
        <button
          key={seat.id}
          type="button"
          className={getSeatClassName(seat)}
          title={`${seat.id} - ${getSeatType(seat.row).name} - ${currency}${seat.price}`}
          onClick={() => handleSeatClick(seat)}
        >
          {start + index + 1}
        </button>
      ))}
    </div>
  );

  const renderSeatRow = (row, rowIndex) => {
    const showAisle = seatLayout.aislePosition > 0 && seatLayout.aislePosition < seatLayout.seatsPerRow;

    return (
      <div key={`${rowIndex}-${movieName}`} className="flex items-center mb-2">
        <span className="w-8 text-center font-bold text-gray-600 mr-4">
          {rowLabel(rowIndex)}
        </span>
        {showAisle ? (
          <>
            {renderSeatSection(row, 0, seatLayout.aislePosition)}
            <div className="w-8" />
            {renderSeatSection(row, seatLayout.aislePosition, seatLayout.seatsPerRow)}
          </>
        ) : (
          renderSeatSection(row, 0, seatLayout.seatsPerRow)
        )}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
              {movieName}
            </h1>
            <p className="text-gray-600">{movieSubtitle}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView("booking")}
              className={`rounded-lg px-4 py-2 font-medium ${
                view === "booking"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Guest booking
            </button>
            <button
              type="button"
              onClick={() => setView("admin")}
              className={`rounded-lg px-4 py-2 font-medium ${
                view === "admin"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Admin panel
            </button>
          </div>
        </div>

        {view === "booking" ? (
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="grid gap-2 sm:grid-cols-3 mb-6">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                      wizardStep === step
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    Step {step}:{" "}
                    {step === 1
                      ? "Name"
                      : step === 2
                      ? "Select seats"
                      : "Confirmation"}
                  </div>
                ))}
              </div>

              {wizardStep === 1 && (
                <div className="rounded-lg border border-gray-200 p-5">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Step 1 · Who is booking?
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Enter your full name to unlock seat selection.
                  </p>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                  />
                  <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-semibold">Guest credits</p>
                    <p>
                      {currentGuestRule.fullName}: up to {currentGuestRule.maxSeats} seat(s)
                    </p>
                    <p>
                      Categories:{" "}
                      {currentGuestRule.allowedTypes
                        .map(
                          (type) =>
                            parsedSeatTypes.find((config) => config.type === type)?.name ||
                            type
                        )
                        .join(", ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleContinueFromName}
                    className="mt-4 rounded-lg bg-green-500 px-5 py-3 font-semibold text-white hover:bg-green-600"
                  >
                    Continue to seat selection
                  </button>
                </div>
              )}

              {wizardStep === 2 && (
                <div>
                  <div className="mb-8">
                    <div className="w-full h-4 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 rounded-lg mb-2 shadow-inner" />
                    <p className="text-center text-sm text-gray-500 font-medium">
                      SCREEN
                    </p>
                  </div>

                  <div className="mb-6 overflow-x-auto">
                    <div className="flex flex-col items-center min-w-max">
                      {seatGrid.map((row, rowIndex) => renderSeatRow(row, rowIndex))}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
                    {parsedSeatTypes.map((seatType) => (
                      <div key={seatType.type} className="flex items-center">
                        <div
                          className={`w-6 h-6 border-2 rounded-t-lg mr-2 ${getColorClass(
                            seatType.color
                          )}`}
                        />
                        <span className="text-sm">
                          {seatType.name} ({currency}
                          {seatType.price})
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-green-500 border-2 border-green-600 rounded-t-lg mr-2" />
                      <span className="text-sm">Selected</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-gray-400 border-2 border-gray-500 rounded-t-lg mr-2" />
                      <span className="text-sm">Booked</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="rounded-lg bg-gray-100 px-5 py-3 font-semibold text-gray-700"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueFromSeats}
                      className="rounded-lg bg-green-500 px-5 py-3 font-semibold text-white hover:bg-green-600"
                    >
                      Continue to confirmation
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="rounded-lg border border-gray-200 p-5">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">
                    Step 3 · Confirm booking
                  </h2>

                  {completedBooking ? (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-green-50 p-4 text-green-800">
                        <p className="font-semibold">Booking confirmed</p>
                        <p>{completedBooking.name}</p>
                        <p>{completedBooking.seatIds.join(", ")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={resetWizard}
                        className="rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white"
                      >
                        Start another booking
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-gray-50 p-4">
                        <p className="font-semibold text-gray-800">{guestName.trim()}</p>
                        <p className="text-gray-600">
                          Seats: {selectedSeatIds.join(", ")}
                        </p>
                        <p className="text-gray-600">
                          Categories:{" "}
                          {selectedSeatTypeSummary
                            .map(({ seatId, seatType }) => `${seatId} (${seatType.name})`)
                            .join(", ")}
                        </p>
                        <p className="mt-2 text-lg font-bold text-green-600">
                          Total: {currency}
                          {totalPrice}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setWizardStep(2)}
                          className="rounded-lg bg-gray-100 px-5 py-3 font-semibold text-gray-700"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmBooking}
                          className="rounded-lg bg-green-500 px-5 py-3 font-semibold text-white hover:bg-green-600"
                        >
                          Confirm booking
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {bookingMessage && (
                <div
                  className={`mt-4 rounded-lg p-3 text-center ${
                    bookingMessage.type === "success"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {bookingMessage.text}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="font-bold text-lg mb-2">Booking summary</h3>
                <p className="text-sm text-gray-600 mb-1">
                  Guest: {guestName.trim() || "Not entered yet"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Seats: {selectedSeatIds.length ? selectedSeatIds.join(", ") : "None"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Seat count: {selectedSeatIds.length}
                </p>
                <p className="text-xl font-bold text-green-600">
                  Total: {currency}
                  {totalPrice}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="font-bold text-lg mb-2">Share this event</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Unique booking URL
                </p>
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm break-all">
                  {shareUrl}
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="font-bold text-lg mb-2">Current bookings</h3>
                <div className="space-y-3">
                  {bookings.length > 0 ? (
                    bookings.map((booking) => (
                      <div key={booking.id} className="rounded-lg bg-white p-3 shadow-sm">
                        <p className="font-semibold text-gray-800">{booking.name}</p>
                        <p className="text-sm text-gray-600">
                          {booking.seatIds.join(", ")}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No bookings yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <section className="rounded-lg border border-gray-200 p-5">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Movie details
                </h2>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={movieName}
                    onChange={(event) => setMovieName(event.target.value)}
                    placeholder="Movie name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                  />
                  <input
                    type="text"
                    value={movieSubtitle}
                    onChange={(event) => setMovieSubtitle(event.target.value)}
                    placeholder="Subtitle"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                  />
                  <input
                    type="text"
                    value={sessionSlug}
                    onChange={(event) => setSessionSlug(event.target.value)}
                    placeholder="Unique URL slug"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                  />
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 break-all">
                    {shareUrl}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveMovie}
                    className="rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white"
                  >
                    Save movie details
                  </button>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-5">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Theatre layout
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="number"
                    min="1"
                    value={layoutDraft.rows}
                    onChange={(event) =>
                      setLayoutDraft((current) => ({
                        ...current,
                        rows: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                    placeholder="Rows"
                  />
                  <input
                    type="number"
                    min="1"
                    value={layoutDraft.seatsPerRow}
                    onChange={(event) =>
                      setLayoutDraft((current) => ({
                        ...current,
                        seatsPerRow: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                    placeholder="Seats per row"
                  />
                  <input
                    type="number"
                    min="0"
                    value={layoutDraft.aislePosition}
                    onChange={(event) =>
                      setLayoutDraft((current) => ({
                        ...current,
                        aislePosition: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                    placeholder="Aisle"
                  />
                </div>

                <div className="mt-4 space-y-3">
                  {seatTypeDrafts.map((seatType) => (
                    <div
                      key={seatType.type}
                      className="grid gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-[1fr_120px_1fr]"
                    >
                      <input
                        type="text"
                        value={seatType.name}
                        onChange={(event) =>
                          setSeatTypeDrafts((current) =>
                            current.map((draft) =>
                              draft.type === seatType.type
                                ? { ...draft, name: event.target.value }
                                : draft
                            )
                          )
                        }
                        className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                        placeholder="Category name"
                      />
                      <input
                        type="number"
                        min="0"
                        value={seatType.price}
                        onChange={(event) =>
                          setSeatTypeDrafts((current) =>
                            current.map((draft) =>
                              draft.type === seatType.type
                                ? { ...draft, price: event.target.value }
                                : draft
                            )
                          )
                        }
                        className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                        placeholder="Price"
                      />
                      <input
                        type="text"
                        value={seatType.rowsInput}
                        onChange={(event) =>
                          setSeatTypeDrafts((current) =>
                            current.map((draft) =>
                              draft.type === seatType.type
                                ? { ...draft, rowsInput: event.target.value }
                                : draft
                            )
                          )
                        }
                        className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                        placeholder="Rows e.g. A-C"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSaveLayout}
                  className="mt-4 rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white"
                >
                  Save theatre layout
                </button>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Guest credits
                  </h2>
                  <button
                    type="button"
                    onClick={handleAddGuestCredit}
                    className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Add guest
                  </button>
                </div>

                <div className="space-y-3">
                  {guestCredits.map((credit) => (
                    <div key={credit.id} className="rounded-lg bg-gray-50 p-4">
                      <div className="grid gap-3 md:grid-cols-[1.5fr_120px]">
                        <input
                          type="text"
                          value={credit.fullName}
                          onChange={(event) =>
                            handleUpdateGuestCredit(
                              credit.id,
                              "fullName",
                              event.target.value
                            )
                          }
                          placeholder="Full name"
                          className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                        />
                        <input
                          type="number"
                          min="1"
                          value={credit.maxSeats}
                          onChange={(event) =>
                            handleUpdateGuestCredit(
                              credit.id,
                              "maxSeats",
                              Number(event.target.value)
                            )
                          }
                          placeholder="Credits"
                          className="rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {parsedSeatTypes.map((seatType) => (
                          <label
                            key={`${credit.id}-${seatType.type}`}
                            className="flex items-center gap-2 text-sm text-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={credit.allowedTypes.includes(seatType.type)}
                              onChange={() =>
                                handleToggleAllowedType(credit.id, seatType.type)
                              }
                            />
                            {seatType.name}
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveGuestCredit(credit.id)}
                        className="mt-3 text-sm font-semibold text-red-600"
                      >
                        Remove guest
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Booking management
                  </h2>
                  <button
                    type="button"
                    onClick={handleClearAllBookings}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Clear all
                  </button>
                </div>

                <div className="space-y-3">
                  {bookings.length > 0 ? (
                    bookings.map((booking) => (
                      <div key={booking.id} className="rounded-lg bg-gray-50 p-4">
                        {editingBookingId === booking.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(event) => setEditingName(event.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                            />
                            <input
                              type="text"
                              value={editingSeats}
                              onChange={(event) => setEditingSeats(event.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-900"
                            />
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={handleSaveBookingEdit}
                                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBookingId(null)}
                                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold text-gray-800">{booking.name}</p>
                              <p className="text-sm text-gray-600">
                                Seats: {booking.seatIds.join(", ")}
                              </p>
                              <p className="text-sm text-gray-600">
                                Total: {currency}
                                {booking.totalPrice}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditingBooking(booking)}
                                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBooking(booking.id)}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No bookings to manage.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {adminMessage && view === "admin" && (
          <div
            className={`mt-6 rounded-lg p-3 text-center ${
              adminMessage.type === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {adminMessage.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default CinemaSeatBooking;
