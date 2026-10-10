function cssStops(gradient) {
  return gradient.stops
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");
}

export function gradientToCss(gradient) {
  return `background-image: linear-gradient(${gradient.angle}deg, ${cssStops(gradient)});`;
}

export function gradientToClassCss(gradient) {
  return `.gradient-${gradient.slug} {\n  ${gradientToCss(gradient)}\n}`;
}

export function gradientToJson(gradient) {
  return JSON.stringify(
    {
      name: gradient.name,
      slug: gradient.slug,
      family: gradient.family,
      angle: gradient.angle,
      stops: gradient.stops,
      css: gradientToCss(gradient)
    },
    null,
    2
  );
}

export function allGradientsToCss(items) {
  return items.map(gradientToClassCss).join("\n\n");
}

export function allGradientsToJson(items) {
  const result = Object.fromEntries(
    items.map((gradient) => [
      gradient.slug,
      {
        name: gradient.name,
        slug: gradient.slug,
        family: gradient.family,
        angle: gradient.angle,
        stops: gradient.stops,
        css: gradientToCss(gradient)
      }
    ])
  );

  return JSON.stringify(result, null, 2);
}
