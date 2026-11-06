import { NEEDS_CONNECTION, useNeedsConnection } from '../connection.js';

// A button for something only the server can do (buying, coins, games,
// gifts, loans, pets, tournaments). With no connection it's turned off and
// says "Needs a connection" instead of spinning; nothing is saved to send
// later (coins never wait on the device). Everything else is a plain button.
export default function ServerButton({ children, disabled, title, ...props }) {
  const offline = useNeedsConnection();
  return (
    <button {...props} disabled={disabled || offline} title={offline ? 'Works again once you’re back online' : title}>
      {offline ? NEEDS_CONNECTION : children}
    </button>
  );
}
