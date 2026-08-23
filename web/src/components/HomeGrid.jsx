import NavButton from './NavButton';

export default function HomeGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
      <NavButton to="/meeting-schedule" label="Meeting Schedule" />
      <NavButton to="/registration" label="Registration Form" />
      <NavButton to="/restaurant" label="Dinner Restaurant" />
      <NavButton to="/poc-contact" label="POC contact" />
      <NavButton to="/voting" label="Voting" />
    </div>
  );
}
