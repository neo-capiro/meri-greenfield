// Test-only avatar. Production authentication is exercised separately against Next.
export function UserButton() {
  return (
    <button
      aria-label="Test account"
      className="monogram"
      style={{ width: 32, height: 32, borderRadius: "50%" }}
    >
      T
    </button>
  );
}
