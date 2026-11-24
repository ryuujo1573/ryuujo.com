(() => {
  const canvas = document.querySelector('#trip-map');
  const status = document.querySelector('#map-status');
  const caption = document.querySelector('#map-caption-text');
  const buttons = [...document.querySelectorAll('button[data-route]')];
  if (!window.L) return;

  const points = {
    home: {
      coordinates: [30.28148, 120.10228],
      name: '香樟公寓',
      detail: '文三西路 360 号附近。杭州两条市内路线都从这里出发。',
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
    brokenBridge: {
      coordinates: [30.26083, 120.14694],
      name: '断桥',
      detail:
        '从少年宫公交站沿北山街走到桥头。想多走一小段，可以上白堤再折返。',
      query: '断桥残雪',
    },
    yueTemple: {
      coordinates: [30.25472, 120.12944],
      name: '岳王庙',
      detail: '北山街 80 号。7 路往灵隐方向到岳庙站，或短程打车。',
    },
    quyuan: {
      coordinates: [30.25432, 120.12759],
      name: '曲院风荷',
      detail: '体力允许再去，从北门附近沿水岸短走。',
      url: 'https://www.amap.com/place/B023B17WL5',
    },
    qingchun: {
      coordinates: [30.2469, 120.10428],
      name: '庆春朴门',
      detail: '灵隐店在白乐桥 181 号。计划 11:30 吃午饭，电话 0571-87975777。',
      url: 'https://gaode.com/place/B0GKVZ1O4T',
    },
    suzhouNorth: {
      coordinates: [31.42365, 120.63905],
      name: '苏州北站',
      detail: 'G1866 于 09:02 到这里，出站后打车去拙政园。',
    },
    garden: {
      coordinates: [31.3263, 120.6248],
      name: '拙政园与苏博本馆',
      detail: '拙政园东北街 178 号，苏博本馆就在隔壁的 204 号。两处分别预约。',
      query: '拙政园',
    },
    pingjiang: {
      coordinates: [31.32067, 120.626],
      name: '平江路',
      detail: '从白塔东路方向进入，沿河走一小段，再找茶馆休息。',
      query: '平江路与白塔东路交叉口',
    },
    suzhouStation: {
      coordinates: [31.33056, 120.60639],
      name: '苏州站',
      detail: '17:30 左右离开古城，来这里乘 18:52 的 G7491 返回杭州东。',
    },
  };

  const routes = {
    westlake: {
      name: '西湖北岸',
      city: '杭州',
      color: '#1e6154',
      legs: [
        ['home', 'brokenBridge', null],
        ['brokenBridge', 'yueTemple', '8 8'],
        ['yueTemple', 'quyuan', '2 7'],
      ],
      stops: [
        {
          point: 'brokenBridge',
          badge: '01',
          direction: 'right',
          overview: true,
        },
        { point: 'yueTemple', badge: '庙', direction: 'right' },
        { point: 'quyuan', badge: '·', direction: 'bottom', minor: true },
      ],
    },
    lingyin: {
      name: '庆春朴门与灵隐寺',
      city: '杭州',
      color: '#8c3e2f',
      legs: [
        ['home', 'transfer', null],
        ['transfer', 'lingyinBus', '8 8'],
        ['lingyinBus', 'qingchun', '2 7'],
        ['qingchun', 'lingyin', '2 7'],
      ],
      stops: [
        { point: 'transfer', badge: '换', direction: 'left', minor: true },
        { point: 'lingyinBus', badge: '·', direction: 'bottom', minor: true },
        { point: 'qingchun', badge: '餐', direction: 'right' },
        { point: 'lingyin', badge: '02', direction: 'left', overview: true },
      ],
    },
    suzhou: {
      name: '苏州古城',
      city: '苏州',
      color: '#3e557c',
      focus: ['garden', 'pingjiang', 'suzhouStation'],
      legs: [
        ['suzhouNorth', 'garden', null],
        ['garden', 'pingjiang', '2 7'],
        ['pingjiang', 'suzhouStation', null],
      ],
      stops: [
        { point: 'suzhouNorth', badge: '到', direction: 'left' },
        { point: 'garden', badge: '03', direction: 'right' },
        { point: 'pingjiang', badge: '巷', direction: 'bottom' },
        { point: 'suzhouStation', badge: '返', direction: 'left' },
      ],
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
  let activeRoute = 'all';

  function amapLink(point, city) {
    if (point.url) return point.url;
    const query = new URLSearchParams({
      keyword: point.query ?? point.name,
      city,
      view: 'map',
    });
    return 'https://uri.amap.com/search?' + query.toString();
  }

  function pin(key, badge, fill, permanent, direction, minor, city) {
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
    link.href = amapLink(point, city);
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
    activeRoute = key;
    map.closePopup();
    lines.clearLayers();
    markers.clearLayers();

    const ids = key === 'all' ? ['westlake', 'lingyin'] : [key];
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
    if (key !== 'suzhou') {
      pin('home', '起', '#19392f', true, 'right', false, '杭州');
    }
    for (const id of ids) {
      const route = routes[id];
      for (const stop of route.stops) {
        if (key === 'all' && !stop.overview) continue;
        pin(
          stop.point,
          stop.badge,
          route.color,
          !stop.minor,
          stop.direction,
          stop.minor,
          route.city,
        );
      }
    }

    for (const button of buttons)
      button.setAttribute('aria-pressed', String(button.dataset.route === key));
    for (const row of document.querySelectorAll('[data-route-row]')) {
      row.dataset.active = String(row.dataset.routeRow === key);
    }
    status.textContent =
      key === 'all'
        ? '已显示杭州的两条市内路线。'
        : '已显示' + routes[key].name + '路线。';
    caption.textContent =
      key === 'suzhou'
        ? '缩小地图可查看苏州北站，实际走法看导航。'
        : '连线仅供示意，实际走法看导航。';
  }

  function fitRoutes() {
    const narrow = canvas.clientWidth <= 500;
    const focus = routes[activeRoute]?.focus;
    const bounds = focus
      ? L.latLngBounds(focus.map((point) => points[point].coordinates))
      : lines.getBounds();
    map.invalidateSize({ pan: false });
    map.fitBounds(bounds, {
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
