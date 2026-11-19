(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dayMs = 86400000;
  const dateText = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const money = value => '¥' + Number(value).toLocaleString('en-US');
  const asDay = (y, m, d) => Date.UTC(y, m, d) / dayMs;
  const showDate = value => dateText.format(value * dayMs);
  const points = [
    { name:'国贸', coordinates:[116.457,39.914] }, { name:'三里屯', coordinates:[116.456,39.936] },
    { name:'朝阳公园', coordinates:[116.485,39.949] }, { name:'望京', coordinates:[116.480,39.993] },
    { name:'东直门', coordinates:[116.432,39.944] }, { name:'亮马桥', coordinates:[116.467,39.951] },
  ];
  const names = ['云栖酒店','栖岸酒店','梧桐庭院酒店','云庭精品酒店','万象公寓酒店','澄光酒店','晴川酒店','城畔商务酒店'];
  const concepts = ['商务酒店','精品酒店','设计酒店','城市酒店','公寓酒店','商务酒店','精品酒店','商务酒店'];
  const hotels = points.flatMap((point, area) => names.map((name, index) => {
    const rank = area * names.length + index + 1;
    const angle = rank * 2.39996;
    const offset = .0035 + index * .00115;
    return {
      hotelId: 'demo-' + rank, rank, name: point.name + name, area: point.name, concept: concepts[index],
      longitude: point.coordinates[0] + Math.cos(angle) * offset * 1.27,
      latitude: point.coordinates[1] + Math.sin(angle) * offset,
      basePrice: 419 + (rank * 83) % 491,
      score: (4.2 + (rank * 7 % 8) * .1).toFixed(1),
    };
  }));
  const state = {
    begin: asDay(2026, 10, 20), end: asDay(2026, 10, 22), place: points[0], radius: 2,
    selection: null, step: 1, pending: null, pendingRadius: 2, results: [], selectedRate: null,
  };
  let draft, monthOffset, map, mapBoot, pin, markerSystem;
  const diagnostics = { state, get map() { return map; }, mapReady: false, errors: [] };
  window.BookingConsoleDemo = diagnostics;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animation = duration => reducedMotion.matches ? 0 : duration;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action, className) {
    const node = element('button', text, className);
    node.type = 'button';
    node.onclick = action;
    return node;
  }
  function distance(a, b) {
    const rad = Math.PI / 180;
    const sinLat = Math.sin((b[1] - a[1]) * rad / 2);
    const sinLng = Math.sin((b[0] - a[0]) * rad / 2);
    return 12742 * Math.asin(Math.sqrt(sinLat ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * sinLng ** 2));
  }
  function nightly(hotel) {
    const days = state.end - state.begin;
    let total = 0;
    for (let d = state.begin; d < state.end; d++) {
      const dow = new Date(d * dayMs).getUTCDay();
      total += hotel.basePrice + (dow === 5 || dow === 6 ? 45 : 0);
    }
    return Math.round(total / days);
  }
  const countNear = (place, radius) => hotels.filter(h => distance(place.coordinates, [h.longitude,h.latitude]) <= radius).length;
  function setStep(step) {
    state.step = step;
    for (const item of document.querySelectorAll('[data-step]')) {
      const current = Number(item.dataset.step);
      item.classList.toggle('current', current === step);
      item.classList.toggle('done', current < step);
      if (current === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    }
  }
  function drawSearch() {
    $('checkInLabel').textContent = showDate(state.begin);
    $('checkOutLabel').textContent = showDate(state.end);
    $('nightCount').textContent = (state.end - state.begin) + ' 晚';
    $('locationLabel').textContent = '北京 · ' + state.place.name;
    $('locationRadius').textContent = state.radius + ' 公里内';
    $('summary').textContent = showDate(state.begin) + ' – ' + showDate(state.end) + ' · ' + $('guests').value + ' 位成人';
  }
  function searchHotels() {
    const sort = $('sort').value;
    const result = hotels.map(hotel => ({
      ...hotel, distance: distance(state.place.coordinates, [hotel.longitude,hotel.latitude]), nightly: nightly(hotel),
    })).filter(hotel => hotel.distance <= state.radius);
    result.sort((a,b) => sort === 'price' ? a.nightly-b.nightly || a.distance-b.distance
      : sort === 'rating' ? b.score-a.score || a.distance-b.distance : a.distance-b.distance);
    state.results = result;
    const prior = state.selection?.hotelId;
    state.selection = result.find(hotel => hotel.hotelId === prior) ?? result[0] ?? null;
    if (state.selection?.hotelId !== prior) state.selectedRate = null;
    drawResults();
  }
  function drawResults() {
    $('resultsText').textContent = state.results.length + ' 家酒店 · ' + state.place.name + ' ' + state.radius + ' 公里内';
    const rows = state.results.map(h => {
      const row = button('', () => {
        state.selection = h;
        state.selectedRate = null;
        setStep(3);
        drawResults();
        document.querySelector('[data-hotel="' + h.hotelId + '"]').focus({ preventScroll:true });
      }, 'hotel-row' + (state.selection?.hotelId === h.hotelId ? ' active' : ''));
      row.dataset.hotel = h.hotelId;
      row.setAttribute('aria-pressed', String(state.selection?.hotelId === h.hotelId));
      const title = document.createElement('span');
      title.append(element('strong', h.name, 'hotel-name'), element('small', h.concept + ' · 评分 ' + h.score));
      row.append(title, element('span', h.distance.toFixed(1) + ' km', 'distance'), element('strong', money(h.nightly), 'price'));
      return row;
    });
    $('hotels').replaceChildren(...(rows.length ? rows : [element('p','这一范围内暂无模拟酒店，试试扩大搜索范围。','empty')]));
    drawRates();
  }
  function drawRates() {
    const hotel = state.selection;
    const target = $('hotelDetails');
    const nights = state.end - state.begin;
    $('rateContext').textContent = hotel ? nights + ' 晚 · ' + $('guests').value + ' 位成人 · 模拟报价' : '请选择一家酒店';
    if (!hotel) {
      target.replaceChildren(element('p','选择酒店后查看房型和取消规则。','empty'));
      return;
    }
    const details = element('div','','details');
    const info = element('div','','selected-hotel');
    const identity = element('div');
    identity.append(element('h3', hotel.name), element('p', '北京 · ' + hotel.area + ' · 距搜索中心 ' + hotel.distance.toFixed(1) + ' km'));
    info.append(identity, element('span', hotel.score + ' / 5','rating'));
    details.append(info);
    const plans = [
      { room:'标准大床房', terms:'28 ㎡ · 1 张大床 · 不含早', add:0, policy:'入住日前 1 天 18:00 前可免费取消。' },
      { room:'高级双床房', terms:'32 ㎡ · 2 张单人床 · 双早', add:135, policy:'入住日前 2 天 18:00 前可免费取消，之后收取首晚房费。' },
      { room:'行政大床房', terms:'38 ㎡ · 1 张大床 · 双早', add:275, policy:'此演示方案为预付不可取消。' },
    ];
    plans.forEach((plan, index) => {
      const price = hotel.nightly + plan.add;
      const body = element('div');
      body.append(element('h3',plan.room), element('p',plan.terms));
      const amount = element('strong',money(price * nights),'rate-price');
      amount.append(element('small',nights + ' 晚总价'));
      const row = button('', () => {
        state.selectedRate = state.selectedRate === index ? null : index;
        drawRates();
        document.querySelector('[data-rate="' + index + '"]').focus({ preventScroll:true });
      }, 'rate-row' + (state.selectedRate === index ? ' active' : ''));
      row.dataset.rate = index;
      row.setAttribute('aria-expanded',String(state.selectedRate === index));
      row.append(body,amount);
      details.append(row);
      if (state.selectedRate === index) {
        const rules = element('div','','rules');
        rules.append(element('strong','取消规则'), element('p',plan.policy));
        details.append(rules);
      }
    });
    details.append(element('p','选择方案可核对取消规则。价格为模拟含税总价。','rate-note'));
    target.replaceChildren(details);
  }
  function dateRender() {
    const months = [];
    for (let offset = 0; offset < 2; offset++) {
      const first = new Date(Date.UTC(2026,10 + monthOffset + offset,1));
      const year = first.getUTCFullYear(), month = first.getUTCMonth();
      const block = element('section','','month');
      block.append(element('h3',year + ' 年 ' + (month + 1) + ' 月'));
      const cells = element('div','','days');
      for (const day of ['一','二','三','四','五','六','日']) cells.append(element('span',day,'weekday'));
      for (let d = 0; d < (first.getUTCDay() + 6) % 7; d++) cells.append(element('span'));
      const count = new Date(Date.UTC(year,month + 1,0)).getUTCDate();
      for (let d = 1; d <= count; d++) {
        const day = asDay(year,month,d);
        const choose = button(String(d), () => {
          if (draft.end === null && day > draft.begin) draft.end = day;
          else draft = { begin:day, end:null };
          dateRender();
          document.querySelector('[data-day="' + day + '"]').focus({ preventScroll:true });
        }, 'day');
        choose.dataset.day = day;
        choose.dataset.date = new Date(day * dayMs).toISOString().slice(0,10);
        choose.setAttribute('aria-label', year + '年' + showDate(day));
        const edge = day === draft.begin || day === draft.end;
        if (edge) choose.classList.add('edge');
        else if (draft.end !== null && day > draft.begin && day < draft.end) choose.classList.add('in-range');
        choose.setAttribute('aria-pressed',String(edge));
        cells.append(choose);
      }
      block.append(cells);
      months.push(block);
    }
    $('months').replaceChildren(...months);
    $('calendarHint').textContent = draft.end === null ? '请选择离店日期' : '先选择入住日，再选择离店日。';
    $('dateRange').textContent = draft.end === null ? showDate(draft.begin) + ' 入住'
      : showDate(draft.begin) + ' – ' + showDate(draft.end) + ' · ' + (draft.end - draft.begin) + ' 晚';
    $('dateConfirm').disabled = draft.end === null;
  }
  function circle(place, radius) {
    const [lng,lat] = place.coordinates;
    const points = Array.from({length:65}, (_,i) => {
      const angle = i / 64 * Math.PI * 2;
      return [lng + radius * Math.cos(angle) / (111.32 * Math.cos(lat * Math.PI / 180)), lat + radius * Math.sin(angle) / 110.57];
    });
    return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[points]}};
  }
  function pendingRender() {
    const point = state.pending;
    $('pendingPlace').textContent = point.name;
    $('pendingCoordinates').textContent = point.coordinates.map(c => c.toFixed(4)).join(', ');
    $('radius').value = String(state.pendingRadius);
    $('pendingCount').textContent = countNear(point,state.pendingRadius);
    $('mapSummary').textContent = '北京 · ' + point.name + ' · ' + state.pendingRadius + ' 公里内';
    for (const preset of $('presets').children) preset.classList.toggle('active', preset.textContent === point.name);
    if (!diagnostics.mapReady) return;
    pin.setLngLat(point.coordinates);
    map.getSource('search-area').setData(circle(point,state.pendingRadius));
  }
  function setPending(point, pan) {
    state.pending = point;
    pendingRender();
    if (pan && diagnostics.mapReady) map.easeTo({center:point.coordinates, zoom:Math.max(12.1,map.getZoom()), duration:animation(470)});
  }
  async function startMap() {
    const style = await loadMapStyle();
    map = new maplibregl.Map({
      container:'map',style,center:state.pending.coordinates,zoom:12.0,minZoom:9,maxZoom:17,dragRotate:false,
      touchPitch:false,attributionControl:false,renderWorldCopies:false,fadeDuration:reducedMotion.matches ? 0 : 150,
      maxBounds:[[115.95,39.52],[116.98,40.35]],
    });
    map.touchZoomRotate.disableRotation();
    markerSystem = createHotelMarkers({
      map,hotels,drawLogo:()=>{},padding:()=>({top:26,bottom:26,left:24,right:24}),
      onSelect(h) { if (h) setPending({ name:h.area, coordinates:[h.longitude,h.latitude] }, false); },
      onError: message => diagnostics.errors.push(message),
    });
    map.on('error',e=>diagnostics.errors.push(e.error?.message ?? 'Map error'));
    await new Promise(resolve=>map.once('load',resolve));
    map.addSource('search-area',{type:'geojson',data:circle(state.pending,state.pendingRadius)});
    map.addLayer({id:'search-area-fill',type:'fill',source:'search-area',paint:{'fill-color':'#386ff6','fill-opacity':.12}});
    map.addLayer({id:'search-area-stroke',type:'line',source:'search-area',paint:{'line-color':'#5180e4','line-width':1.5,'line-dasharray':[3,2]}});
    markerSystem.attach();
    markerSystem.update(hotels.map(h=>({...h,kind:'plain',priceMinor:nightly(h)*100})),null);
    pin = new maplibregl.Marker({element:element('div','','picker-point'),anchor:'center'}).setLngLat(state.pending.coordinates).addTo(map);
    map.on('click',event=>{
      if (map.queryRenderedFeatures(event.point,{layers:['hotel-prices']}).length) return;
      const coords = event.lngLat.toArray();
      const nearest = points.reduce((a,b)=>distance(coords,a.coordinates)<distance(coords,b.coordinates)?a:b);
      setPending({name:distance(coords,nearest.coordinates)<.4 ? nearest.name : nearest.name+'附近',coordinates:coords},false);
    });
    diagnostics.mapReady = true;
    pendingRender();
  }
  function openMap() {
    state.pending = state.place;
    state.pendingRadius = state.radius;
    setStep(2);
    $('placePicker').showModal();
    pendingRender();
    $('mapError').hidden = true;
    if (!mapBoot) {
      mapBoot = startMap().catch(error=>{
        diagnostics.errors.push(error.message);
        $('mapError').textContent = '地图未能载入，可用右侧常用位置继续。';
        $('mapError').hidden = false;
      });
    } else if (diagnostics.mapReady) {
      map.resize();
      map.jumpTo({center:state.pending.coordinates,zoom:12.0});
      markerSystem.update(hotels.map(h=>({...h,kind:'plain',priceMinor:nightly(h)*100})),null);
    }
  }
  $('dateOpen').onclick = () => {
    draft = { begin:state.begin,end:state.end };
    const date = new Date(state.begin * dayMs);
    monthOffset = (date.getUTCFullYear()-2026)*12 + date.getUTCMonth()-10;
    setStep(1);
    dateRender();
    $('calendar').showModal();
  };
  $('dateClose').onclick = () => $('calendar').close();
  $('dateConfirm').onclick = () => {
    if (draft.end === null) return;
    state.begin = draft.begin;
    state.end = draft.end;
    state.selectedRate = null;
    $('calendar').close();
    drawSearch();
    searchHotels();
  };
  $('previousMonth').onclick = () => { monthOffset--; dateRender(); };
  $('nextMonth').onclick = () => { monthOffset++; dateRender(); };
  $('mapOpen').onclick = $('mapLocation').onclick = openMap;
  $('mapClose').onclick = () => $('placePicker').close();
  $('placePicker').addEventListener('close',()=>{ if(state.step === 2) setStep(1); });
  $('presets').append(...points.filter((_,i)=>i<4).map(point=>button(point.name,()=>setPending(point,true))));
  $('radius').onchange = event => { state.pendingRadius = Number(event.target.value); pendingRender(); };
  $('zoomIn').onclick = () => { if(diagnostics.mapReady) map.zoomIn({duration:animation(290)}); };
  $('zoomOut').onclick = () => { if(diagnostics.mapReady) map.zoomOut({duration:animation(290)}); };
  $('mapConfirm').onclick = () => {
    state.place = state.pending;
    state.radius = state.pendingRadius;
    state.selection = null;
    state.selectedRate = null;
    setStep(3);
    $('placePicker').close();
    drawSearch();
    searchHotels();
    $('hotels').scrollTop = 0;
  };
  $('guests').onchange = () => { drawSearch(); drawRates(); };
  $('sort').onchange = searchHotels;
  setStep(1);
  drawSearch();
  searchHotels();
})();
