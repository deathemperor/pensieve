/**
 * Card Hover Animation
 *
 * A card component where the description slides up from the bottom on hover.
 * Uses CSS transitions with transform and opacity for smooth animation.
 *
 * Key techniques:
 * - Transform translateY to slide content in/out
 * - Combined transition on transform and opacity
 * - :hover and :focus-visible for accessibility
 * - overflow: hidden on parent to clip content
 */

// card-hover.css
const styles = `
.card-hover {
  width: 340px;
  height: 340px;
  border-radius: 16px;
  background: #fff;
  display: flex;
  align-items: flex-end;
  text-decoration: none;
  box-shadow: 0px 0px 0px 1px rgba(9, 9, 11, 0.08),
    0px 1px 2px -1px rgba(9, 9, 11, 0.08),
    0px 2px 4px 0px rgba(9, 9, 11, 0.04);
  overflow: hidden;
}

.card-hover-description {
  border-radius: 12px;
  border: 1px solid #fff;
  position: relative;
  background: #fafafa;
  margin: 6px;
  width: 100%;
  padding: 10px 14px 13px;
  font-size: 13px;
  box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.08),
    0px 1px 2px -1px rgba(0, 0, 0, 0.08),
    0px 2px 4px 0px rgba(0, 0, 0, 0.04);

  /* Animation - hidden by default */
  transform: translateY(calc(100% + 8px));
  transition-duration: 350ms;
  transition-timing-function: ease;
  transition-property: transform, opacity;
  opacity: 0;
}

/* Show on hover or keyboard focus */
.card-hover:hover .card-hover-description,
.card-hover:focus-visible .card-hover-description {
  transform: translateY(0%);
  opacity: 1;
}

.card-hover-title {
  color: #1b1b1d;
  font-weight: 500;
}

.card-hover-subtitle {
  color: #717175;
  line-height: 1;
  margin-top: 4px;
}
`;

export default function CardHover() {
  return (
    <a href="#" className="card-hover">
      <div className="card-hover-description">
        <h3 className="card-hover-title">Project name</h3>
        <p className="card-hover-subtitle">Project description</p>
      </div>
    </a>
  );
}
