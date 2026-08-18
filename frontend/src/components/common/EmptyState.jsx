import Icon from './Icon.jsx';

export default function EmptyState({ icon = 'box', title = 'Nothing here yet', subtitle }) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <h3>{title}</h3>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </div>
  );
}