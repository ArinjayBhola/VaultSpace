export function viewportRectangle(
  transform: number[],
  geometry: { x: number; y: number; width: number; height: number },
) {
  const [a, b, c, d, e, f] = transform;
  const point = (x: number, y: number) => [
    a * x + c * y + e,
    b * x + d * y + f,
  ];
  return [
    ...point(geometry.x, geometry.y),
    ...point(geometry.x + geometry.width, geometry.y + geometry.height),
  ];
}
