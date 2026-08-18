export default function Loader({ text = 'Loading...', size = '' }) {
  return (
    <div className="loader-wrap">
      <div className={`spinner ${size}`} />
      {text && <p>{text}</p>}
    </div>
  );
}

export function FullScreenLoader({ text = 'Loading' }) {
  return (
    <div className="fullscreen-loader">
      <div className="spinner" />
      <p>{text}...</p>
    </div>
  );
}

export function InlineLoader({ size = 'sm' }) {
  return <span className={`spinner spinner-${size}`} style={{ display: 'inline-block', verticalAlign: 'middle' }} />;
}