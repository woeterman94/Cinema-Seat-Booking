import "./App.css";
import CinemaSeatBooking from "./components/cinema-seat-booking";

// Main App component
function App() {
  return (
    <CinemaSeatBooking
      layout={{
        rows: 8,
        seatsPerRow: 12,
        aislePosition: 5,
      }}
      seatTypes={{
        regular: { name: "Regular", price: 150, rows: [0, 1, 2] },
        premium: { name: "Premium", price: 250, rows: [3, 4, 5] },
        vip: { name: "VIP", price: 350, rows: [6, 7] },
      }}
      bookedSeats={["C2", "C4"]}
      title="Movie Night at My Place"
      subtitle="Step through your name, seats, and confirmation before booking."
      onBookingComplete={(booking) => console.log("Booking confirmed", booking)}
    />
  );
}

export default App;
