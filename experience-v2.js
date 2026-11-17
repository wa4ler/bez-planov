'use strict';
/* A local, accessible route illustration. No tiles, geocoding, keys or network requests. */
(function (global) {
  const WIDTH = 800, HEIGHT = 430;
  const controllers = new WeakMap();
  let drawingNumber = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const catalog = () => typeof PLACES === 'undefined' ? {} : PLACES;
  const areas = () => typeof AREA_BY_ID === 'undefined' ? {} : AREA_BY_ID;
  const numeral = value => Number(value).toFixed(1);
  const coordinatesOK = value => Array.isArray(value) && value.length >= 2 && value.slice(0, 2).every(Number.isFinite) && Math.abs(value[0]) <= 90 && Math.abs(value[1]) <= 180;
  const shortName = (value, limit = 28) => String(value || '').length > limit ? String(value).slice(0, limit - 1).trim() + '…' : String(value || '');
  function hash(value) { let result = 2166136261; for (const char of String(value)) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); } return (result >>> 0).toString(36); }
  function cardId(day, stop, index) { return 'bp-stop-' + hash((day?.date || day?.areaId || 'day') + ':' + index + ':' + (stop?.id || 'stop')); }
  function stopCount(count) { const n = count % 100; return count + ' ' + (n > 10 && n < 15 ? 'остановок' : count % 10 === 1 ? 'остановка' : [2, 3, 4].includes(count % 10) ? 'остановки' : 'остановок'); }
  function dataFor(day) {
    const places = catalog();
    return (Array.isArray(day?.stops) ? day.stops : []).map((stop, index) => {
      const place = stop.kind === 'place' ? places[stop.id] : null;
      return {
        stop, index, number: index + 1, place,
        name: place?.name || stop.name || (stop.kind === 'break' ? 'Пауза' : 'Ваше событие'),
        coordinates: place && coordinatesOK(place.coordinates) ? place.coordinates : null,
        type: stop.kind === 'fixed' ? 'Ваше событие · адрес в карточке' : stop.kind === 'break' ? (stop.purpose === 'meal' ? 'Питание · место выберете вы' : 'Пауза · без отдельной точки') : 'Примерная точка из подборки'
      };
    });
  }
  function projection(items, areaId) {
    const points = items.filter(item => item.coordinates).map(item => item.coordinates);
    const fallback = typeof AREA_COORDS !== 'undefined' && coordinatesOK(AREA_COORDS[areaId]) ? AREA_COORDS[areaId] : [55.75, 37.62];
    if (!points.length) points.push(fallback);
    const latitudes = points.map(point => point[0]), longitudes = points.map(point => point[1]);
    const middleLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
    const middleLon = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
    const cosine = Math.cos(middleLat * Math.PI / 180);
    const longitudeRange = Math.max((Math.max(...longitudes) - Math.min(...longitudes)) * cosine, .012);
    const latitudeRange = Math.max(Math.max(...latitudes) - Math.min(...latitudes), .009);
    const scale = Math.min((WIDTH - 170) / longitudeRange, (HEIGHT - 165) / latitudeRange);
    return point => ({ x: WIDTH / 2 + (point[1] - middleLon) * cosine * scale, y: HEIGHT / 2 - (point[0] - middleLat) * scale });
  }
  const river = [[55.743,37.510],[55.741,37.533],[55.744,37.548],[55.741,37.565],[55.731,37.573],[55.724,37.585],[55.726,37.598],[55.734,37.607],[55.742,37.607],[55.744,37.615],[55.746,37.624],[55.748,37.635],[55.747,37.650],[55.742,37.660],[55.736,37.650],[55.728,37.651],[55.716,37.671],[55.708,37.682],[55.697,37.684],[55.684,37.691],[55.668,37.688],[55.652,37.682]];
  const roads = [
    [[55.812,37.580],[55.779,37.598],[55.756,37.616],[55.733,37.626],[55.698,37.640]],
    [[55.782,37.558],[55.764,37.585],[55.754,37.620],[55.752,37.657],[55.749,37.701]],
    [[55.743,37.529],[55.751,37.566],[55.752,37.597],[55.754,37.619]],
    [[55.754,37.619],[55.776,37.632],[55.803,37.638],[55.833,37.638],[55.864,37.643]],
    [[55.753,37.621],[55.741,37.600],[55.727,37.574],[55.709,37.550]],
    [[55.764,37.582],[55.767,37.611],[55.761,37.641]],
    [[55.741,37.591],[55.738,37.622],[55.745,37.652]],
    [[55.839,37.598],[55.833,37.617],[55.826,37.638],[55.817,37.660]],
    [[55.680,37.641],[55.669,37.662],[55.656,37.677]]
  ];
  const parks = [
    [[55.740,37.606],[55.734,37.615],[55.725,37.601],[55.718,37.582],[55.727,37.586]],
    [[55.840,37.598],[55.848,37.616],[55.839,37.640],[55.824,37.637],[55.828,37.613]],
    [[55.677,37.664],[55.668,37.685],[55.650,37.683],[55.651,37.658],[55.665,37.655]],
    [[55.754,37.625],[55.753,37.633],[55.749,37.635],[55.750,37.626]]
  ];
  const polyline = (points, project) => points.map(point => { const position = project(point); return numeral(position.x) + ',' + numeral(position.y); }).join(' ');
  function underlay(project, uniqueID) {
    const centre = project([55.755,37.617]), ringEast = project([55.755,37.651]), ringNorth = project([55.774,37.617]);
    return '<defs><pattern id="' + uniqueID + '-blocks" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-16)"><rect x="5" y="5" width="32" height="32" rx="7" fill="none" stroke="currentColor" stroke-width=".65"/></pattern><radialGradient id="' + uniqueID + '-light"><stop offset="0" stop-color="#9cae82" stop-opacity=".1"/><stop offset="1" stop-color="#0f1a15" stop-opacity=".2"/></radialGradient></defs>' +
      '<rect width="800" height="430" class="bp-map-ground"/><rect width="800" height="430" fill="url(#' + uniqueID + '-light)"/><rect width="800" height="430" fill="url(#' + uniqueID + '-blocks)" class="bp-map-blocks"/>' +
      parks.map(points => '<polygon points="' + polyline(points, project) + '" class="bp-map-park"/>').join('') +
      '<g class="bp-map-roads">' + roads.map(points => '<polyline points="' + polyline(points, project) + '"/>').join('') + '<ellipse cx="' + numeral(centre.x) + '" cy="' + numeral(centre.y) + '" rx="' + numeral(Math.abs(ringEast.x - centre.x)) + '" ry="' + numeral(Math.abs(ringNorth.y - centre.y)) + '"/></g>' +
      '<polyline points="' + polyline(river, project) + '" class="bp-map-river-edge"/><polyline points="' + polyline(river, project) + '" class="bp-map-river"/>';
  }
  function drawing(items, day, uniqueID, preview) {
    const project = projection(items, day?.areaId), located = items.filter(item => item.coordinates);
    const positions = located.map(item => ({ ...item, ...project(item.coordinates) }));
    // Separate overlapping symbols with a short leader, without moving their underlying coordinate.
    for (let i = 0; i < positions.length; i++) {
      const point = positions[i]; point.symbolX = point.x; point.symbolY = point.y;
      let attempts = 0;
      while (positions.slice(0, i).some(other => Math.hypot(other.symbolX - point.symbolX, other.symbolY - point.symbolY) < 42) && attempts < 12) {
        attempts++; const angle = attempts * 2.4;
        point.symbolX = point.x + Math.cos(angle) * (22 + attempts * 5);
        point.symbolY = point.y + Math.sin(angle) * (22 + attempts * 5);
      }
      point.symbolX = Math.min(WIDTH - 35, Math.max(35, point.symbolX));
      point.symbolY = Math.min(HEIGHT - 35, Math.max(35, point.symbolY));
    }
    const connection = positions.map((point, index) => {
      if (!index) return '';
      const previous = positions[index - 1];
      const middleX = (previous.x + point.x) / 2, middleY = (previous.y + point.y) / 2 - 12;
      return '<path class="bp-map-order" d="M' + numeral(previous.x) + ' ' + numeral(previous.y) + ' Q' + numeral(middleX) + ' ' + numeral(middleY) + ' ' + numeral(point.x) + ' ' + numeral(point.y) + '"/>';
    }).join('');
    return '<svg class="route-map" viewBox="0 0 800 430" aria-labelledby="' + uniqueID + '-title ' + uniqueID + '-description" role="group" xmlns="http://www.w3.org/2000/svg"><title id="' + uniqueID + '-title">' + (preview ? 'Пример порядка мест в Замоскворечье' : 'Порядок остановок вашего дня') + '</title><desc id="' + uniqueID + '-description">Точки по приблизительным координатам. Пунктир соединяет остановки по порядку и не показывает реальную дорогу. Выберите номер, чтобы открыть карточку.</desc>' +
      '<g aria-hidden="true">' + underlay(project, uniqueID) + connection + '</g>' +
      positions.map(point => '<a href="#' + cardId(day, point.stop, point.index) + '" class="bp-map-pin" data-bp-map-stop="' + point.index + '" data-map-x="' + numeral(point.symbolX) + '" data-map-y="' + numeral(point.symbolY) + '" aria-label="Остановка ' + point.number + ': ' + escape(point.name) + '. ' + (preview ? 'Выбрать на схеме.' : 'Перейти к карточке.') + '" tabindex="0"><title>' + escape(point.name) + '</title>' +
        (Math.hypot(point.x - point.symbolX, point.y - point.symbolY) > 2 ? '<line x1="' + numeral(point.x) + '" y1="' + numeral(point.y) + '" x2="' + numeral(point.symbolX) + '" y2="' + numeral(point.symbolY) + '" class="bp-map-leader"/>' : '') +
        '<circle cx="' + numeral(point.symbolX) + '" cy="' + numeral(point.symbolY) + '" r="26" class="bp-map-pin-ring"/><circle cx="' + numeral(point.symbolX) + '" cy="' + numeral(point.symbolY) + '" r="18" class="bp-map-pin-disc"/><text x="' + numeral(point.symbolX) + '" y="' + numeral(point.symbolY + .5) + '" class="bp-map-pin-number">' + point.number + '</text></a>').join('') + '</svg>';
  }
  function renderMap(day, cfg, options = {}) {
    const items = dataFor(day), located = items.filter(item => item.coordinates), unlocated = items.length - located.length;
    const preview = !!options.preview, uniqueID = 'bp-map-' + (++drawingNumber), area = areas()[day?.areaId];
    const heading = preview ? 'Так может выглядеть ваш день' : 'Ваш день, точка за точкой';
    return '<section class="route-map-panel bp-map' + (preview ? ' bp-map-preview' : '') + '" data-bp-map aria-labelledby="' + uniqueID + '-heading" data-map-mode="' + (located.length ? 'map' : 'list') + '">' +
      '<div class="bp-map-heading"><div><p class="bp-map-kicker">' + (preview ? 'Пример · ' : 'Москва · ') + escape(area?.name || 'маршрут для двоих') + '</p><h2 id="' + uniqueID + '-heading">' + heading + '</h2></div><span class="bp-map-count">' + stopCount(items.length) + '</span></div>' +
      '<div class="bp-map-toolbar"><div class="bp-map-modes" role="group" aria-label="Вид маршрута"><button type="button" data-bp-map-mode="map" aria-pressed="' + !!located.length + '"' + (!located.length ? ' disabled' : '') + '>На схеме</button><button type="button" data-bp-map-mode="list" aria-pressed="' + !located.length + '">Список мест</button></div><span class="bp-map-legend"><i aria-hidden="true"></i>Порядок остановок</span></div>' +
      '<div class="bp-map-canvas"' + (!located.length ? ' hidden' : '') + '>' + drawing(items, day, uniqueID, preview) + '<span class="bp-map-city" aria-hidden="true">МОСКВА</span><div class="bp-map-compass" aria-hidden="true"><span>С</span><svg viewBox="0 0 24 24"><path d="m12 3 6 17-6-4-6 4Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></div><div class="bp-map-zoom" role="group" aria-label="Масштаб схемы"><button type="button" data-bp-map-zoom="in" aria-label="Приблизить схему">+</button><button type="button" data-bp-map-zoom="out" aria-label="Отдалить схему">−</button><button type="button" data-bp-map-zoom="reset" aria-label="Показать все остановки" class="bp-map-fit"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button></div></div>' +
      '<ol class="bp-map-stop-list"' + (located.length ? ' hidden' : '') + '>' + items.map(item => '<li><button type="button" data-bp-map-stop="' + item.index + '"><span class="bp-map-list-number">' + item.number + '</span><span><strong>' + escape(item.name) + '</strong><small>' + escape(item.stop.time || '') + ' · ' + escape(item.type) + '</small></span><span class="bp-map-list-arrow" aria-hidden="true">↗</span></button></li>').join('') + (!items.length ? '<li class="bp-map-empty">Здесь появятся места вашего дня.</li>' : '') + '</ol>' +
      '<div class="bp-map-selection" aria-live="polite" aria-atomic="true">' + (located[0] ? '<span class="bp-map-selection-number">' + located[0].number + '</span><span>' + escape(located[0].name) + '</span>' : '<span>Для этих остановок нет координат. Адреса и детали — в карточках.</span>') + '</div>' +
      (unlocated ? '<p class="bp-map-unlocated">' + stopCount(unlocated) + ' без отдельной точки: события и паузы смотрите в списке и карточках.</p>' : '') +
      '<p class="bp-map-notice">' + (preview ? 'Пример для знакомства с сервисом. ' : '') + 'Схема по приблизительным координатам. Проверьте дорогу в картах.</p></section>';
  }
  function mountMap(root, day, cfg, options = {}) {
    if (!root) return () => {};
    controllers.get(root)?.destroy();
    root.innerHTML = renderMap(day, cfg, options);
    const panel = root.querySelector('[data-bp-map]'), svg = root.querySelector('.route-map'), canvas = root.querySelector('.bp-map-canvas'), list = root.querySelector('.bp-map-stop-list');
    const items = dataFor(day), cardsRoot = options.cardsRoot || null, cards = cardsRoot ? [...cardsRoot.querySelectorAll('.stop[data-stop-id]')] : [];
    const cardElements = items.map(item => cards[item.index]?.dataset.stopId === String(item.stop.id) ? cards[item.index] : cards.find(card => card.dataset.stopId === String(item.stop.id)));
    let selected = items.find(item => item.coordinates)?.index ?? 0, zoom = 1;
    const insertedButtons = [];
    cardElements.forEach((card, index) => {
      if (!card) return;
      card.id = cardId(day, items[index].stop, index); card.tabIndex = -1;
      if (!items[index].coordinates) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'bp-map-return'; button.dataset.bpMapReturn = String(index);
      button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 5 4-2 6 2 4-2v12l-4 2-6-2-4 2V5Zm4-2v12m6-10v12" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>Показать на схеме';
      (card.querySelector('.stop-card') || card).append(button); insertedButtons.push(button);
    });
    function updateZoom() {
      const pin = root.querySelector('.bp-map-pin[data-bp-map-stop="' + selected + '"]');
      const width = WIDTH / zoom, height = HEIGHT / zoom;
      const centreX = pin ? Number(pin.dataset.mapX) : WIDTH / 2, centreY = pin ? Number(pin.dataset.mapY) : HEIGHT / 2;
      const x = Math.max(0, Math.min(WIDTH - width, centreX - width / 2)), y = Math.max(0, Math.min(HEIGHT - height, centreY - height / 2));
      svg.setAttribute('viewBox', [x, y, width, height].map(numeral).join(' '));
      root.querySelector('[data-bp-map-zoom="in"]').disabled = zoom >= 2.5;
      root.querySelector('[data-bp-map-zoom="out"]').disabled = zoom <= 1;
    }
    function mode(value) {
      const chosen = value === 'map' && items.some(item => item.coordinates) ? 'map' : 'list';
      panel.dataset.mapMode = chosen; canvas.hidden = chosen !== 'map'; list.hidden = chosen !== 'list';
      root.querySelectorAll('[data-bp-map-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bpMapMode === chosen)));
    }
    function select(index, { focusCard = false, focusMap = false } = {}) {
      const item = items[index]; if (!item) return false;
      selected = index;
      root.querySelectorAll('[data-bp-map-stop]').forEach(node => { const active = Number(node.dataset.bpMapStop) === index; node.classList.toggle('is-selected', active); if (active) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current'); });
      cardElements.forEach((card, i) => card?.classList.toggle('bp-map-card-selected', i === index));
      const status = root.querySelector('.bp-map-selection');
      status.innerHTML = '<span class="bp-map-selection-number">' + item.number + '</span><span>' + escape(item.name) + (!item.coordinates ? '<small>Без отдельной точки на схеме</small>' : '') + '</span>';
      if (item.coordinates && zoom > 1) updateZoom();
      const card = cardElements[index];
      const behavior = global.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      if (focusCard && card) { card.scrollIntoView({ behavior, block: 'start' }); card.focus({ preventScroll: true }); }
      if (focusMap) {
        mode(item.coordinates ? 'map' : 'list');
        const node = root.querySelector((item.coordinates ? '.bp-map-pin' : '.bp-map-stop-list button') + '[data-bp-map-stop="' + index + '"]');
        (node || panel).scrollIntoView({ behavior, block: 'center' }); node?.focus({ preventScroll: true });
      }
      options.onSelect?.(item.stop, index); return true;
    }
    function click(event) {
      const stop = event.target.closest('[data-bp-map-stop]');
      if (stop) { event.preventDefault(); select(Number(stop.dataset.bpMapStop), { focusCard: !options.preview }); return; }
      const toggle = event.target.closest('[data-bp-map-mode]'); if (toggle) { mode(toggle.dataset.bpMapMode); return; }
      const control = event.target.closest('[data-bp-map-zoom]');
      if (control) { zoom = control.dataset.bpMapZoom === 'reset' ? 1 : Math.max(1, Math.min(2.5, zoom + (control.dataset.bpMapZoom === 'in' ? .5 : -.5))); updateZoom(); }
    }
    function keydown(event) { if (event.key === ' ' && event.target.matches('.bp-map-pin')) { event.preventDefault(); select(Number(event.target.dataset.bpMapStop), { focusCard: !options.preview }); } }
    function cardClick(event) { const button = event.target.closest('[data-bp-map-return]'); if (button) { event.preventDefault(); select(Number(button.dataset.bpMapReturn), { focusMap: true }); } }
    root.addEventListener('click', click); root.addEventListener('keydown', keydown); cardsRoot?.addEventListener('click', cardClick);
    updateZoom(); select(selected);
    function destroy() { root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); cardsRoot?.removeEventListener('click', cardClick); insertedButtons.forEach(button => button.remove()); cardElements.forEach(card => card?.classList.remove('bp-map-card-selected')); controllers.delete(root); }
    controllers.set(root, { destroy, select }); return destroy;
  }
  function renderCinematicPreview() {
    return '<figure class="bp-cinematic-map" data-bp-cinematic-preview>' +
      '<a class="bp-cinematic-image" href="/assets/moscow-map-cinematic.webp" target="_blank" rel="noopener noreferrer" aria-label="Рассмотреть иллюстрацию Москвы в полном размере — откроется изображение">' +
      '<img src="/assets/moscow-map-cinematic.webp" width="1280" height="720" loading="lazy" alt="Художественная иллюстрация вечерней Москвы с условными остановками: ресторан, парк, кино и спа"></a>' +
      '<figcaption class="bp-cinematic-caption"><div><p>Москва. Одна история на двоих.</p><span>Иллюстрация настроения: места и линии условные. Это не навигационная карта.</span></div>' +
      '<a href="/assets/moscow-map-cinematic.webp" target="_blank" rel="noopener noreferrer">Рассмотреть изображение <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 15 10-10M5 5h10v10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></a></figcaption></figure>';
  }
  function mountCinematicPreview(root) {
    if (!root) return () => {};
    controllers.get(root)?.destroy();
    root.innerHTML = renderCinematicPreview();
    function destroy() { controllers.delete(root); }
    controllers.set(root, { destroy, select: () => false });
    return destroy;
  }
  global.BPExperience = Object.freeze({
    renderMap, mountMap, cardId,
    selectStop(root, index, options) { return controllers.get(root)?.select(index, options) || false; },
    renderPreviewMap: renderCinematicPreview,
    mountPreviewMap: mountCinematicPreview
  });
})(window);
