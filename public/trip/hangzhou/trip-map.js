(() => {
  const canvas = document.querySelector('#trip-map');
  const status = document.querySelector('#map-status');
  const buttons = [...document.querySelectorAll('button[data-route]')];
  if (!window.L) return;

  const points = {
    home: {
      coordinates: [30.28148, 120.10228],
      name: '香樟公寓',
      detail: '文三西路 360 号附近，三天都从这里出发。',
      url: 'https://www.amap.com/place/B023B026C6',
    },
    transfer: {
      coordinates: [30.26195, 120.09455],
      name: '西溪路 608 号',
      detail: '打车下客点。沿指示到西溪路换乘大厅，换灵隐接驳车。',
      query: '西溪路608号停车场',
    },
    lingyinBus: {
      coordinates: [30.24618, 120.10526],
      name: '灵隐路 32 号',
      detail: '接驳车停靠的换乘中心，下车后按指示走向灵隐飞来峰。',
      url: 'https://www.amap.com/place/BV09464297',
    },
    lingyin: {
      coordinates: [30.24278, 120.09667],
      name: '灵隐寺',
      detail: '走主路看飞来峰造像和寺院前部。按预约时段入园。',
      query: '灵隐飞来峰景区游客中心',
    },
    xixiGate: {
      coordinates: [30.25733, 120.05645],
      name: '周家村游客中心',
      detail: '打车到周家村入口，再步行前往大码头。',
      query: '西溪湿地周家村游客中心',
    },
    xixi: {
      coordinates: [30.26027, 120.05722],
      name: '周家村大码头',
      detail: '从这里上电瓶船。买票前确认回到同一码头的班次。',
      query: '西溪湿地周家村大码头',
    },
    museum: {
      coordinates: [30.31804, 120.1322],
      name: '工艺美术博物馆',
      detail: '小河路 334 号。从这里向拱宸桥西头短走一段。',
      url: 'https://www.amap.com/place/B023B0I02U',
    },
    canal: {
      coordinates: [30.32044, 120.13418],
      name: '拱宸桥西岸',
      detail: '在西岸看桥与运河，按体力决定要不要继续逛。',
      url: 'https://www.amap.com/place/B0FFL7KMLY',
    },
  };

  const routes = {
    lingyin: {
      name: '灵隐寺',
      number: '01',
      color: '#8c3e2f',
      legs: [
        ['home', 'transfer', null],
        ['transfer', 'lingyinBus', '8 8'],
        ['lingyinBus', 'lingyin', '2 7'],
      ],
      main: ['transfer', 'lingyin'],
      extra: ['lingyinBus'],
    },
    xixi: {
      name: '西溪湿地',
      number: '02',
      color: '#1e6154',
      legs: [
        ['home', 'xixiGate', null],
        ['xixiGate', 'xixi', '2 7'],
      ],
      main: ['xixi'],
      extra: ['xixiGate'],
    },
    canal: {
      name: '拱宸桥西岸',
      number: '03',
      color: '#3e557c',
      legs: [
        ['home', 'museum', null],
        ['museum', 'canal', '2 7'],
      ],
      main: ['canal'],
      extra: ['museum'],
    },
  };

  const L = window.L;
  const map = L.map(canvas, {
    minZoom: 11,
    maxZoom: 18,
    scrollWheelZoom: false,
  });
  canvas.querySelector('.map-fallback').remove();

  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  const tileNote = document.createElement('p');
  tileNote.className = 'map-unavailable';
  tileNote.textContent = '底图暂未载入。仍可点击标记并打开高德地图。';
  tileNote.hidden = true;
  canvas.append(tileNote);
  let tileLoaded = false;
  tiles.on('tileload', () => {
    tileLoaded = true;
    tileNote.hidden = true;
  });
  tiles.on('tileerror', () => {
    if (!tileLoaded) tileNote.hidden = false;
  });

  const lines = L.featureGroup().addTo(map);
  const markers = L.featureGroup().addTo(map);

  function amapLink(point) {
    if (point.url) return point.url;
    const query = new URLSearchParams({
      keyword: point.query,
      city: '杭州',
      view: 'map',
    });
    return 'https://uri.amap.com/search?' + query.toString();
  }

  function pin(key, badge, fill, permanent, direction, minor = false) {
    const point = points[key];
    const icon = L.divIcon({
      className: 'map-pin',
      html: badge,
      iconSize: minor ? [20, 20] : [32, 32],
      iconAnchor: minor ? [10, 10] : [16, 16],
    });
    const marker = L.marker(point.coordinates, {
      icon,
      keyboard: true,
      alt: point.name,
      zIndexOffset: minor ? -100 : 0,
      title: point.name,
    }).addTo(markers);
    const element = marker.getElement();
    element.style.setProperty('--pin', fill);
    element.setAttribute('aria-label', point.name);
    const box = document.createElement('div');
    box.className = 'popup-content';
    const heading = document.createElement('h3');
    heading.textContent = point.name;
    const description = document.createElement('p');
    description.textContent = point.detail;
    const link = document.createElement('a');
    link.href = amapLink(point);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '在高德地图打开';
    box.append(heading, description, link);
    marker.bindPopup(box, { maxWidth: 245 });
    marker.bindTooltip(point.name, {
      permanent,
      direction,
      offset:
        direction === 'right'
          ? [13, 0]
          : direction === 'left'
            ? [-13, 0]
            : [0, 14],
      className: 'map-node-label',
    });
  }

  function showRoute(key) {
    map.closePopup();
    lines.clearLayers();
    markers.clearLayers();

    const ids = key === 'all' ? Object.keys(routes) : [key];
    for (const id of ids) {
      const route = routes[id];
      for (const [from, to, dashArray] of route.legs) {
        const path = [points[from].coordinates, points[to].coordinates];
        L.polyline(path, {
          color: '#fffef8',
          weight: 7,
          opacity: 0.9,
          interactive: false,
        }).addTo(lines);
        L.polyline(path, {
          color: route.color,
          weight: 4,
          dashArray,
          opacity: 0.97,
          interactive: false,
        }).addTo(lines);
      }
    }
    fitRoutes();
    pin('home', '起', '#19392f', true, 'right');
    for (const id of ids) {
      const route = routes[id];
      if (key !== 'all') {
        route.extra.forEach((point) =>
          pin(point, '·', route.color, false, 'right', true),
        );
      }
      route.main.forEach((point) => {
        const isTransfer = point === 'transfer';
        const direction =
          isTransfer || point === 'canal'
            ? 'left'
            : point === 'xixi'
              ? 'bottom'
              : 'right';
        pin(
          point,
          isTransfer ? '换' : route.number,
          route.color,
          !isTransfer || key !== 'all',
          direction,
          isTransfer,
        );
      });
    }

    for (const button of buttons)
      button.setAttribute('aria-pressed', String(button.dataset.route === key));
    for (const row of document.querySelectorAll('[data-route-row]')) {
      row.dataset.active = String(row.dataset.routeRow === key);
    }
    status.textContent =
      key === 'all'
        ? '已显示三天的路线。'
        : '已显示' + routes[key].name + '路线。';
  }

  function fitRoutes() {
    const narrow = canvas.clientWidth <= 500;
    map.invalidateSize({ pan: false });
    map.fitBounds(lines.getBounds(), {
      padding: narrow ? [28, 28] : [65, 35],
      maxZoom: 14,
      animate: false,
    });
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      showRoute(button.dataset.route);
      if (
        button.classList.contains('guide-select') &&
        window.matchMedia('(max-width: 650px)').matches
      ) {
        canvas.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  showRoute('all');
  for (const button of buttons) button.disabled = false;
  let previousWidth = canvas.clientWidth;
  const resize = new ResizeObserver(() => {
    if (canvas.clientWidth === previousWidth) return;
    previousWidth = canvas.clientWidth;
    fitRoutes();
  });
  resize.observe(canvas);
})();
