export function renderLineChart(svg, points) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!points || points.length === 0) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', '50%'); t.setAttribute('y', '50%');
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#4b5563'); t.setAttribute('font-size', '12');
    t.textContent = 'No data';
    svg.appendChild(t); return;
  }
  const W = svg.viewBox?.baseVal?.width || 800;
  const H = svg.viewBox?.baseVal?.height || 120;
  const PAD = { top: 8, right: 8, bottom: 20, left: 44 };
  const w = W - PAD.left - PAD.right;
  const h = H - PAD.top - PAD.bottom;

  const xs = points.map(p => p.bucket);
  const ys = points.map(p => p.value);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMax = Math.max(...ys, 0.01);
  const xRange = xMax - xMin || 1;

  const cx = x => PAD.left + ((x - xMin) / xRange) * w;
  const cy = y => PAD.top + h - (y / yMax) * h;

  const ns = 'http://www.w3.org/2000/svg';

  // Y grid + labels
  [0, 0.5, 1].forEach(t => {
    const y = PAD.top + h * (1 - t);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', PAD.left); line.setAttribute('x2', PAD.left + w);
    line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('stroke', '#1e293b'); line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', PAD.left - 4); lbl.setAttribute('y', y + 4);
    lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('fill', '#4b5563'); lbl.setAttribute('font-size', '10');
    lbl.textContent = '$' + (yMax * t).toFixed(3);
    svg.appendChild(lbl);
  });

  // Area fill
  const areaD = `M${cx(xs[0])},${cy(0)} ` +
    points.map(p => `L${cx(p.bucket)},${cy(p.value)}`).join(' ') +
    ` L${cx(xs[xs.length - 1])},${cy(0)} Z`;
  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaD);
  area.setAttribute('fill', 'rgba(124,58,237,.15)');
  svg.appendChild(area);

  // Line
  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(p.bucket)},${cy(p.value)}`).join(' ');
  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', lineD);
  line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#7c3aed'); line.setAttribute('stroke-width', '2');
  svg.appendChild(line);
}
