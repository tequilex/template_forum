// Демо-сид: посты + комменты от существующих юзеров на тему PC-сборок и
// рабочих мест. Картинки — picsum.photos (см. next.config.ts → demoImageHosts).
// Идемпотентно по префиксу slug'а `demo-*`.
//
// Usage:
//   DATABASE_URL=... pnpm tsx scripts/seed-demo.ts          — добавить демо-контент
//   DATABASE_URL=... pnpm tsx scripts/seed-demo.ts --clean  — удалить весь demo-* контент
//   DATABASE_URL=... pnpm tsx scripts/seed-demo.ts --reset  — clean + seed
//
// Каскад posts → comments + post_tags настроен в схеме, поэтому --clean чистит всё разом.

import { like } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db";
import { posts, postTags, tags, users, comments } from "@db/schema";
import { newId } from "@/lib/auth/id";
import { slugify, uniqueSlug } from "@/lib/slugify";
import { renderBlock } from "@/components/editor/renderBlock";
import { sanitize } from "@/components/editor/sanitize";
import { extractPlainText } from "@/components/editor/extractPlainText";
import { extractCoverUrl } from "@/components/editor/extractCoverUrl";

const argv = process.argv.slice(2);
const doClean = argv.includes("--clean") || argv.includes("--reset");
const doSeed = !argv.includes("--clean") || argv.includes("--reset");

type Block =
  | { type: "paragraph"; data: { text: string } }
  | { type: "header"; data: { text: string; level: number } }
  | { type: "image"; data: { file: { url: string }; caption?: string } }
  | { type: "list"; data: { style: "unordered" | "ordered"; items: string[] } }
  | { type: "quote"; data: { text: string; caption?: string } }
  | { type: "delimiter"; data: Record<string, never> };

interface PostTemplate {
  title: string;
  tags: string[]; // slug list — должны существовать в tags
  blocks: Block[];
  withCover?: boolean; // если true — первый image-блок становится coverUrl
}

// picsum: ?seed=<s> делает картинку детерминированной по seed'у. Размеры берём
// 1200x675 (16:9) для cover'ов и 800x500 для inline-картинок.
const cover = (seed: string) => `https://picsum.photos/seed/${seed}/1200/675`;
const inline = (seed: string) => `https://picsum.photos/seed/${seed}/800/500`;

const TEMPLATES: PostTemplate[] = [
  {
    title: "Собрал ПК за 120к: ryzen 7700 + rtx 4070",
    tags: ["experience", "review"],
    withCover: true,
    blocks: [
      { type: "image", data: { file: { url: cover("rig-7700-4070") }, caption: "Финальный вид сборки" } },
      { type: "paragraph", data: { text: "Долго копил, долго думал, в итоге взял <b>Ryzen 7 7700</b> + <b>RTX 4070</b>. Делюсь опытом — может, кому пригодится." } },
      { type: "header", data: { text: "Конфигурация", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "CPU: AMD Ryzen 7 7700 (без X — экономия 5к, в играх разницы ноль)",
        "GPU: Palit RTX 4070 Dual",
        "RAM: 32 ГБ DDR5-6000 (Kingston Fury Beast)",
        "MB: MSI B650 Tomahawk",
        "PSU: be quiet! Pure Power 12 M 750W",
        "Case: Lian Li Lancool 216",
      ] } },
      { type: "paragraph", data: { text: "Итого по чекам — <b>118 400 ₽</b>. Брал в DNS и Citilink частями, ловил скидки." } },
      { type: "header", data: { text: "Что бы поменял", level: 2 } },
      { type: "paragraph", data: { text: "Жалею, что не взял корпус с mesh-фронтом получше — Lancool 216 норм, но температуры на воздухе уровня 75°C под Cyberpunk." } },
    ],
  },
  {
    title: "Как я обустроил рабочее место в однушке",
    tags: ["experience", "lifehack"],
    withCover: true,
    blocks: [
      { type: "image", data: { file: { url: cover("workspace-flat") }, caption: "Угол у окна" } },
      { type: "paragraph", data: { text: "Живу в однушке 36 м². Работаю из дома уже третий год. Когда-то ноут стоял на кухонном столе — спина намекнула, что так нельзя." } },
      { type: "header", data: { text: "Что взял", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "Стол с регулировкой высоты IKEA Bekant (когда-то), сейчас — Ergostol Optima",
        "Кресло Hara Chair Nietzsche (б/у с авито за 25к)",
        "Монитор LG 27UP850 — 27 дюймов, 4K, USB-C",
        "Полка-органайзер за монитором — IKEA Kallax 2x2",
      ] } },
      { type: "paragraph", data: { text: "Главное правило — стол стоит торцом к окну, чтобы свет падал сбоку, а не в монитор." } },
      { type: "quote", data: { text: "Купите нормальное кресло. Серьёзно. Это единственная вещь, на которой не надо экономить.", caption: "я после трёх лет на офисном стуле" } },
    ],
  },
  {
    title: "Стоит ли брать RTX 4060 в 2026?",
    tags: ["question", "opinion"],
    blocks: [
      { type: "paragraph", data: { text: "Вижу, что 4060 уже подешевела до 32-35к. С одной стороны — 8 ГБ памяти, не круто. С другой — DLSS 3, frame gen, тихая в стоке." } },
      { type: "paragraph", data: { text: "Что думаете? Стоит ли брать сейчас или ждать 5060? Использовать буду в 1440p, не AAA-маньяк." } },
      { type: "header", data: { text: "Альтернативы", level: 3 } },
      { type: "list", data: { style: "unordered", items: [
        "RX 7700 XT — 12 ГБ, в чистом расте побыстрее, но без FG",
        "RTX 4060 Ti 16GB — на 15к дороже, оно того не стоит наверное",
        "Б/у 3070 — 10-15к экономия, но без гарантии",
      ] } },
    ],
  },
  {
    title: "Обзор Lian Li O11 Dynamic: год эксплуатации",
    tags: ["review", "experience"],
    withCover: true,
    blocks: [
      { type: "image", data: { file: { url: cover("o11-dynamic") } } },
      { type: "paragraph", data: { text: "Купил O11 Dynamic год назад. Не EVO, не XL — обычный. За год успел и пожалеть, и полюбить. Делюсь честным отзывом." } },
      { type: "header", data: { text: "Плюсы", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "Аквариум — выглядит шикарно",
        "Кабель-менеджмент за PSU-крышкой — даже мне криворукому удалось",
        "Очень много места под радиаторы (360 сверху + 360 сбоку + 280 снизу)",
      ] } },
      { type: "header", data: { text: "Минусы", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "ПЫЛЬ. Через стекло видно всё, через 2 недели — пыльная вечеринка",
        "Стандартные вентиляторы не очень — менял на Noctua",
        "PSU вкладывается через узкую щель, очень неудобно",
      ] } },
      { type: "paragraph", data: { text: "Купил бы снова? <b>Да, но с учётом ежемесячной уборки.</b>" } },
    ],
  },
  {
    title: "Как почистить ПК от пыли за 20 минут",
    tags: ["lifehack"],
    blocks: [
      { type: "paragraph", data: { text: "Раз в полгода рекомендую обязательно. Иначе температуры начинают плыть, а вентиляторы — гудеть как турбина." } },
      { type: "header", data: { text: "Что нужно", level: 2 } },
      { type: "list", data: { style: "ordered", items: [
        "Баллон со сжатым воздухом (300-500₽, любой OBI)",
        "Тряпка из микрофибры",
        "Изопропиловый спирт (для термопасты, если решил перенаносить)",
        "Крестовая отвёртка",
      ] } },
      { type: "header", data: { text: "Порядок", level: 2 } },
      { type: "list", data: { style: "ordered", items: [
        "Выключить ПК, отсоединить кабели, вынести на балкон или в ванну",
        "Снять боковую крышку, продуть от радиаторов и вентиляторов",
        "Зафиксировать лопасти кулера пальцем — иначе подшипники убьются",
        "Пройтись микрофиброй по стеклу и крышке",
        "Собрать обратно, наслаждаться тишиной",
      ] } },
    ],
  },
  {
    title: "DDR5 vs DDR4 в 2026: уже пора?",
    tags: ["opinion", "question"],
    blocks: [
      { type: "paragraph", data: { text: "Когда DDR5 только вышла, разница в цене была 2x при околонулевой разнице в реальных задачах. Сейчас всё иначе." } },
      { type: "paragraph", data: { text: "32 ГБ DDR5-6000 стоят 9-11к. 32 ГБ DDR4-3600 — 6-7к. Разница 3-4к. На AM5 выбора нет — только DDR5. На LGA1700 — выбирай, но переход на новую платформу всё равно через 2-3 года будет." } },
      { type: "header", data: { text: "Моё мнение", level: 3 } },
      { type: "paragraph", data: { text: "Если собираешь сейчас — иди в DDR5. Долгосрочно она выигрывает, и разница в цене больше не критичная." } },
    ],
  },
  {
    title: "Зачем я перешёл с одного монитора на два",
    tags: ["experience", "lifehack"],
    withCover: true,
    blocks: [
      { type: "image", data: { file: { url: cover("dual-monitor") }, caption: "Сетап после апгрейда" } },
      { type: "paragraph", data: { text: "Десять лет работал на одном мониторе. Считал, что мне хватает. Год назад добавил второй — теперь не понимаю, как жил." } },
      { type: "paragraph", data: { text: "Сетап: основной 27\" 4K + вспомогательный 24\" 1080p в вертикальной ориентации (для документации и slack)." } },
      { type: "header", data: { text: "Что изменилось", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "IDE на главном, всегда видно docs/задачи на втором",
        "Видеокол на втором мониторе — лица собеседников всегда в поле зрения",
        "Перестал бесконечно alt-tabать между окнами",
      ] } },
      { type: "quote", data: { text: "Один монитор — это как одна нога. Технически можно, но зачем?" } },
    ],
  },
  {
    title: "Тихая сборка: nvme без турбины и видеокарта на 0 RPM",
    tags: ["experience", "review"],
    blocks: [
      { type: "paragraph", data: { text: "Я не выношу гул. Месяц назад пересобрал ПК с одной целью — чтобы при бытовой нагрузке (браузер, ide, фоновая музыка) ничего не крутилось вообще." } },
      { type: "header", data: { text: "Что получилось", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "GPU: RTX 4070 Super Inno3D Twin X2 — в простое 0 RPM, до 50°C",
        "CPU: Ryzen 7 7700 + Noctua NH-D15 — на офисной нагрузке кулер на 400 RPM",
        "Корпус: Fractal Define 7 Compact — с шумоизоляционными панелями",
        "SSD: Samsung 990 Pro 2TB с радиатором (важно, без радиатора ловит троттлинг)",
      ] } },
      { type: "paragraph", data: { text: "Шум на расстоянии 50 см от корпуса — <b>~22 дБ</b>. Это тише, чем шёпот. Под игровой нагрузкой — около 32 дБ, всё ещё ок." } },
    ],
  },
  {
    title: "Новости от Intel: Core Ultra 300 с TDP 65 Вт",
    tags: ["news"],
    blocks: [
      { type: "paragraph", data: { text: "На IFA Intel показал следующее поколение десктопных процессоров — Core Ultra 300. Главная фишка — TDP базовой линейки снижен до 65 Вт без потери производительности на ядро." } },
      { type: "paragraph", data: { text: "По официальным слайдам, прирост IPC относительно Core Ultra 200 — около 12%. Это меньше, чем хотелось бы, но если TDP действительно 65 Вт — это серьёзный шаг навстречу тихим сборкам." } },
      { type: "paragraph", data: { text: "Релиз — Q3 2026. Цены не объявлены, но ждать что-то революционное по цене не стоит." } },
    ],
  },
  {
    title: "Какой блок питания брать в 2026?",
    tags: ["question"],
    blocks: [
      { type: "paragraph", data: { text: "Старичок Corsair RM650x умер после 6 лет верной службы. Думаю, на что менять." } },
      { type: "paragraph", data: { text: "Конфиг: Ryzen 7 7700, RTX 4070 Super, 32 GB RAM, 2 nvme. По калькулятору outervision — пик потребления около 480 Вт." } },
      { type: "header", data: { text: "Кандидаты", level: 3 } },
      { type: "list", data: { style: "unordered", items: [
        "be quiet! Pure Power 12 M 750W — 9к, ATX 3.1, 80+ Gold",
        "Corsair RM850x (2024) — 14к, любимая классика, запас на апгрейд GPU",
        "Seasonic Focus GX-750 — 11к, безоговорочный workhorse",
      ] } },
      { type: "paragraph", data: { text: "Склоняюсь к Corsair, потому что хочется один раз и надолго. Но 14к за бп — морально тяжело. Что брали вы?" } },
    ],
  },
  {
    title: "Мой первый кастомный кулер: водянка своими руками",
    tags: ["experience"],
    withCover: true,
    blocks: [
      { type: "image", data: { file: { url: cover("custom-loop") }, caption: "В сборе, без жидкости" } },
      { type: "paragraph", data: { text: "Всегда мечтал собрать кастомную водянку. AIO — это понятно и удобно, но мне хотелось чувствовать процесс." } },
      { type: "paragraph", data: { text: "Спойлер: я залил материнку. Не критично — высушил, работает. Но впечатления от первой сборки навсегда." } },
      { type: "header", data: { text: "Что покупал", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "Радиатор Alphacool NexXxoS UT60 360",
        "Помпа+резервуар EK-Quantum Kinetic FLT 240",
        "Водоблок EK-Quantum Velocity² для AM5",
        "Фитинги Bitspower Touchaqua G1/4",
        "Шланг Mayhems Ultra Clear 13/10",
      ] } },
      { type: "paragraph", data: { text: "Итого — около 35к на саму петлю, без GPU-блока. С учётом цены, AIO 360 за 12к выглядит крайне рационально. Но это не про рациональность." } },
    ],
  },
  {
    title: "Эргономика клавиатуры: split vs ortho vs обычная",
    tags: ["opinion", "experience"],
    blocks: [
      { type: "paragraph", data: { text: "За последние два года прошёл путь от обычной мембранной до сплит-ортолинейной (ZSA Voyager). Делюсь субъективом." } },
      { type: "header", data: { text: "Обычная (TKL/65%)", level: 3 } },
      { type: "paragraph", data: { text: "Самая комфортная для большинства. Если запястья не болят и руки на клавиатуре не сидят 10 часов — нет смысла менять." } },
      { type: "header", data: { text: "Ortholinear (Planck/Preonic)", level: 3 } },
      { type: "paragraph", data: { text: "Ровные ряды клавиш. На вкус. Я привык за 2 недели, но скорость печати на родном русском упала на месяц." } },
      { type: "header", data: { text: "Split", level: 3 } },
      { type: "paragraph", data: { text: "Самое большое влияние на самочувствие. Плечи раскрыты, запястья прямые. Через месяц забыл, что у меня болели руки." } },
    ],
  },
  {
    title: "Куда девать старый ПК после апгрейда?",
    tags: ["question"],
    blocks: [
      { type: "paragraph", data: { text: "Апгрейднулся с i5-10400 + GTX 1660 на новую AM5 платформу. Старая железка вполне рабочая, но мне больше не нужна." } },
      { type: "header", data: { text: "Варианты", level: 3 } },
      { type: "list", data: { style: "unordered", items: [
        "Продать целиком на Авито (около 30к, если возиться)",
        "Разобрать и продать по запчастям (40-45к, но месяц переписки)",
        "Подарить родителям/друзьям (благое дело, но как-то жалко)",
        "Сделать домашний сервер (Plex, Home Assistant, торренты)",
      ] } },
      { type: "paragraph", data: { text: "Думаю всё-таки в сервер — i5-10400 в idle ест 30 Вт, это около 200₽/мес электричества. Что выбрали бы вы?" } },
    ],
  },
  {
    title: "Свет на рабочем столе: лампа Xiaomi vs BenQ ScreenBar",
    tags: ["review", "lifehack"],
    withCover: true,
    blocks: [
      { type: "image", data: { file: { url: cover("screenbar") } } },
      { type: "paragraph", data: { text: "Полгода работал с лампой Xiaomi Mi LED Desk Lamp 1S (~3500₽). Месяц назад взял BenQ ScreenBar Halo (~16к). Разница — фундаментальная." } },
      { type: "header", data: { text: "Xiaomi", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "+ Дёшево, симпатично, гнётся куда угодно",
        "− Стоит на столе → отъедает место",
        "− Светит точкой, неравномерно",
        "− Иногда бликует на матовом мониторе",
      ] } },
      { type: "header", data: { text: "BenQ", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "+ Висит на мониторе, на столе чисто",
        "+ Автояркость + автоподстройка по температуре",
        "+ Свет асимметричный — не попадает в экран вообще",
        "− Цена. 16к за лампу — морально странно",
      ] } },
      { type: "paragraph", data: { text: "Через месяц с BenQ — глаза устают заметно меньше. Стоит ли своих денег? Если за компом 8+ часов — да." } },
    ],
  },
  {
    title: "Сборка для жены: офис + Sims 4",
    tags: ["experience"],
    blocks: [
      { type: "paragraph", data: { text: "Жена обновляла ноут — попросила собрать ей десктоп. Требования: тихо, красиво, без RGB, чтобы шли Симсы." } },
      { type: "header", data: { text: "Сборка", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "CPU: Ryzen 5 7600 (с боксовым кулером — для офисной нагрузки хватает)",
        "GPU: RX 6600 — для Симсов с запасом",
        "RAM: 16 ГБ DDR5-5600",
        "Корпус: Fractal Design Pop Air белый",
        "PSU: be quiet! Pure Power 12 M 550W",
      ] } },
      { type: "paragraph", data: { text: "Итого: <b>62 000 ₽</b>. Симсы 4 идут на максималках, Cities Skylines — тоже норм. Жена довольна, я доволен." } },
    ],
  },
  {
    title: "Лайфхак: организация кабелей за столом",
    tags: ["lifehack"],
    withCover: true,
    blocks: [
      { type: "image", data: { file: { url: cover("cable-management") }, caption: "До и после" } },
      { type: "paragraph", data: { text: "Пять лет под столом висел адский кубок проводов. На прошлой неделе провёл вечер с пакетом из IKEA и тремя стяжками. Результат превзошёл ожидания." } },
      { type: "header", data: { text: "Что использовал", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "IKEA SIGNUM (кабель-короб под столом) — 700₽",
        "Стяжки на липучке (не пластиковые) — 200₽ за упаковку",
        "Магнитный держатель для кабелей на торец стола — 500₽",
        "Удлинитель с раздельными выключателями — 1200₽",
      ] } },
      { type: "paragraph", data: { text: "Итого 2.6к и два часа времени. Стол визуально стал в 1.5 раза просторнее." } },
    ],
  },
  {
    title: "Почему я больше не покупаю RGB",
    tags: ["opinion"],
    blocks: [
      { type: "paragraph", data: { text: "Раньше я был фанатом RGB. Светилось всё: память, кулер, корпус, мышка, клавиатура, коврик. Сейчас — выключил всё, и не жалею." } },
      { type: "header", data: { text: "Что не так с RGB", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "Отвлекает. Даже в неактивной зоне периферического зрения",
        "Каждый бренд — свой софт. iCUE, Mystic Light, Polychrome, Aura Sync — и они не дружат",
        "Дорого. RAM с RGB +2к, кулер с RGB +1.5к, корпусные вентиляторы — еще +3к",
        "Через год кто-нибудь сломается, и в темноте не светится только один вентилятор. Раздражает невыносимо",
      ] } },
      { type: "paragraph", data: { text: "Сейчас в моей сборке светится один маленький логотип на мат.плате. И мне хорошо." } },
    ],
  },
  {
    title: "Стоит ли переходить на noctua? честный обзор NH-D15",
    tags: ["review"],
    withCover: true,
    blocks: [
      { type: "image", data: { file: { url: cover("nh-d15") } } },
      { type: "paragraph", data: { text: "NH-D15 — легенда. Стоит 12к в 2026, есть варианты с RGB (D15S chromax) и без. Я брал классический коричнево-бежевый. И вот что думаю." } },
      { type: "header", data: { text: "Плюсы", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "Тихий. Реально тихий. На 800 RPM не слышен",
        "Эффективный. На Ryzen 7 7700 в стресс-тесте — 72°C",
        "Качество сборки на уровне швейцарских часов",
      ] } },
      { type: "header", data: { text: "Минусы", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "ОГРОМНЫЙ. Не во все корпуса влезет (165 мм высота)",
        "Перекрывает первый слот памяти — если у тебя высокие радиаторы памяти, не подойдёт",
        "Коричневый цвет любят не все",
      ] } },
      { type: "paragraph", data: { text: "Альтернатива — Thermalright Peerless Assassin 120 SE (~3.5к), на 90% той же эффективности. Если бюджет жмёт — берите её." } },
    ],
  },
  {
    title: "Что я понял про SSD за 5 лет",
    tags: ["experience", "opinion"],
    blocks: [
      { type: "paragraph", data: { text: "За пять лет я владел Samsung 970 EVO, 980 Pro, Kingston KC3000, WD SN850X и тремя SATA SSD от разных брендов. Делюсь выводами." } },
      { type: "list", data: { style: "ordered", items: [
        "<b>Скорости 7 ГБ/с почти не нужны.</b> Разница между Gen4 и Gen3 в реальной работе — никакая. Только в синтетике.",
        "<b>TLC vs QLC — критично.</b> QLC дешевле, но после заполнения 80% начинает тормозить. Никогда не QLC.",
        "<b>Радиатор обязателен.</b> Без него nvme троттлит уже через минуту нагрузки.",
        "<b>Бренд почти не важен.</b> Samsung/WD/Kingston/Crucial — все ок. Главное — TLC и нормальный контроллер.",
      ] } },
      { type: "paragraph", data: { text: "Сейчас сижу на 990 Pro 2 TB + Crucial T500 2 TB для бэкапов. Достаточно для всего." } },
    ],
  },
  {
    title: "ПК в гостиной: HTPC сборка 2026",
    tags: ["experience"],
    blocks: [
      { type: "paragraph", data: { text: "Захотелось медиа-ПК для гостиной. Чтобы тихо, маленько, и можно было поиграть в инди вечером с дивана." } },
      { type: "header", data: { text: "Конфиг", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "CPU: Ryzen 5 8600G (со встройкой Radeon 760M)",
        "MB: ASRock B650M-HDV/M.2",
        "RAM: 32 ГБ DDR5-5600",
        "Корпус: SilverStone Sugo SG13B (Mini-ITX, объём 11 л)",
        "PSU: SilverStone SX450-B SFX 450W",
      ] } },
      { type: "paragraph", data: { text: "Без отдельной видяхи. 760M тянет старые AAA на средних в 1080p, инди и эмуляторы — летают." } },
      { type: "paragraph", data: { text: "Подключен к LG OLED по HDMI 2.1, sound — через ресивер. Управление с дивана — клавиатура Logitech K400 Plus." } },
    ],
  },
  {
    title: "Куда смотрит провайдер: настройка домашнего DNS",
    tags: ["lifehack", "experience"],
    blocks: [
      { type: "paragraph", data: { text: "Заметил, что провайдер периодически зачем-то редиректит DNS-запросы. Решил поднять свой Pi-hole, заодно избавился от рекламы на всех устройствах." } },
      { type: "header", data: { text: "На чём поднял", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "Raspberry Pi 4 4GB (был под рукой) + microSD 32GB",
        "Pi-hole в docker",
        "Unbound в качестве recursive resolver — не идёт ни в Google, ни в провайдера",
        "На роутере DHCP отдаёт IP пи как единственный DNS",
      ] } },
      { type: "paragraph", data: { text: "За месяц — 1.4 млн заблокированных запросов. Скорость интернета не изменилась. Реклама пропала на TV, мобиле, тостере." } },
    ],
  },
  {
    title: "Сколько RAM реально нужно в 2026",
    tags: ["opinion", "question"],
    blocks: [
      { type: "paragraph", data: { text: "Вопрос вечный. Маркетинг тянет к 64 ГБ, реальность — обычно нет." } },
      { type: "header", data: { text: "По задачам", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "<b>Только игры:</b> 16 ГБ достаточно, 32 ГБ — комфортно",
        "<b>Игры + браузер на 100 вкладок:</b> 32 ГБ",
        "<b>Разработка + докер + IDE:</b> 32 ГБ ок, 64 ГБ — про запас",
        "<b>Видеомонтаж 4K, рендер:</b> 64 ГБ минимум",
        "<b>VM/виртуализация:</b> 64+",
      ] } },
      { type: "paragraph", data: { text: "По моему опыту, 99% людей живут счастливо на 32 ГБ. Если бюджет жмёт — лучше взять более качественные 32, чем медленные 64." } },
    ],
  },
  {
    title: "Где я смотрю обзоры железа в 2026",
    tags: ["opinion"],
    blocks: [
      { type: "paragraph", data: { text: "Раньше читал Tom's Hardware, AnandTech, смотрел Linus. Сейчас всё иначе. Делюсь актуальной подборкой." } },
      { type: "header", data: { text: "YouTube", level: 3 } },
      { type: "list", data: { style: "unordered", items: [
        "Gamers Nexus — для серьёзных бенчмарков и разбора инцидентов",
        "Hardware Unboxed — лучшие сравнительные обзоры GPU",
        "Optimum — короткие, по делу, без воды",
      ] } },
      { type: "header", data: { text: "Текст", level: 3 } },
      { type: "list", data: { style: "unordered", items: [
        "TechPowerUp — для технических деталей и базы данных по железу",
        "TweakTown — иногда первыми сливают новости",
        "/r/buildapc — для подбора конкретной сборки под задачу",
      ] } },
    ],
  },
  {
    title: "Опыт перехода с Windows на Linux для разработки",
    tags: ["experience", "opinion"],
    blocks: [
      { type: "paragraph", data: { text: "Десять лет на Windows. Полгода назад перешёл на Fedora KDE. Делюсь честным фидбеком." } },
      { type: "header", data: { text: "Что я приобрёл", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "Скорость. Системы загружается за 8 секунд, Docker стартует мгновенно",
        "Контроль. Знаю, что и зачем работает в фоне. На Windows — нет",
        "Никакого WSL — всё нативно",
        "Не нужно перезагружаться раз в неделю",
      ] } },
      { type: "header", data: { text: "Что я потерял", level: 2 } },
      { type: "list", data: { style: "unordered", items: [
        "Adobe (заменил на GIMP и DaVinci Resolve)",
        "Photoshop через Wine работает, но криво",
        "Игры — большинство через Proton идут, но не все",
      ] } },
      { type: "paragraph", data: { text: "Назад не вернусь. Если задумывался — пробуй. Удивишься, насколько в 2026 это уже не страшно." } },
    ],
  },
  {
    title: "Бесшумный NAS для дома: что выбрать?",
    tags: ["question"],
    blocks: [
      { type: "paragraph", data: { text: "Накопилось 6 ТБ фоток и видео с детства. Облако — дорого. Думаю собрать домашний NAS, чтобы тихо стоял в шкафу и шевелился только при доступе." } },
      { type: "header", data: { text: "Варианты", level: 3 } },
      { type: "list", data: { style: "unordered", items: [
        "Synology DS224+ — готовая коробка, 2 диска, 35к. Тихо, удобно, но дорого",
        "Самосбор на N100 + TrueNAS — 25к в железе, плюс ssd и hdd. Гибче, но возни больше",
        "Старый ПК + TrueNAS — бесплатно, но шумно и жрёт 50+ Вт в idle",
      ] } },
      { type: "paragraph", data: { text: "Склоняюсь к Synology — хочется поставить и забыть. Кто-то из вас сидит на самосборе? Стоит того?" } },
    ],
  },
];

// 50 коммент-шаблонов — рандомно распределяются по постам.
const COMMENT_TEMPLATES = [
  "Согласен полностью, сам прошёл этот путь.",
  "А чего bequiet, а не Seasonic? У меня PRIME GX 750W уже 4 года, ноль проблем.",
  "Спасибо за подробный разбор!",
  "У меня такая же сборка, всё работает идеально 👍",
  "А термопасту какую брал? Thermal Grizzly Kryonaut неплохая.",
  "Слишком дорого как по мне. Можно было собрать дешевле.",
  "Тоже думал об этом, но в итоге отказался — слишком много возни.",
  "Картинки супер, прям захотелось себе такое же.",
  "А как с шумом? У меня похожая сборка постоянно гудит.",
  "Не понимаю восторгов, обычная сборка.",
  "Спасибо, как раз искал что-то подобное!",
  "А что с прогревом GPU под Cyberpunk? У меня 4070 кипятится в моменте.",
  "Респект за честный обзор без рекламы.",
  "Эх, мне бы такой бюджет... Сижу на i5-9400 + GTX 1060 :(",
  "Помоги пжл, у меня похожая проблема — стоит ли менять PSU?",
  "А зачем 32 ГБ? 16 хватит для всего.",
  "16 уже мало, поверь. Браузер сжирает 8 в одиночку.",
  "Не понял про DDR5. У меня DDR4-3600 CL14 и я счастлив.",
  "Идея интересная, но реализация так себе.",
  "Согласен про кресло. Сэкономил, потом полгода ходил к остеопату.",
  "Подскажи модель радиатора, который ты использовал?",
  "Тоже Lian Li, тоже жалею про пыль. Купил магнитные фильтры — стало в разы лучше.",
  "А вентиляторы какие в итоге поставил?",
  "Прям как у меня было. Через год привыкаешь к чистке как к зарядке :)",
  "А охлад GPU какой? Слышал, что Palit греется сильнее.",
  "У меня MSI Ventus 3X, держит температуру 67°C под нагрузкой. Не самая тихая, но ок.",
  "Кстати, ScreenBar Halo реально топ. Брал такой же месяц назад.",
  "А я считаю, что переплата за BenQ не оправдана. Mi Desk Lamp 1S норм.",
  "Чувак, спасибо! Из-за тебя пересмотрел свой подход к организации стола.",
  "Это слишком сложно для обычного пользователя, имхо.",
  "Pi-hole — топ. У меня уже два года стоит, не нарадуюсь.",
  "А unbound зачем? Cloudflare DNS быстрее же.",
  "Cloudflare всё ещё знает твои запросы. С unbound — никто не знает.",
  "Боже, как я скучал по таким постам с реальным опытом!",
  "Где брал железо? Citilink сильно дороже DNS сейчас.",
  "Брал на регард ру, хорошие цены и доставка норм.",
  "А что насчёт гарантии? На авито б/у не страшно?",
  "Купил вчера то же кресло — мега кайф, спасибо за совет!",
  "А роутер какой стоит? Хочу подобный сетап.",
  "Я Asus AX86U, не нарадуюсь. Кстати, к Pi-hole отлично коннектится.",
  "Ortho-клавиатура — какая модель?",
  "ZSA Voyager, см. в посте :)",
  "Только что заказал такой же блок питания, спасибо за наводку.",
  "Не покупайте 4060 8GB, серьёзно. 4060 Ti 16GB — overpriced. Лучше RX 7700 XT.",
  "По моему опыту 4060 норм для 1080p. Для 1440p — уже мало памяти.",
  "Может кто посоветует тихий БП на 850W?",
  "Corsair RM850x (2024), без вопросов. Тихий, стабильный.",
  "Делал HTPC на 8600G, доволен на 200%. Со встройкой норм играется.",
  "А прокладку под видяхой меняли? У меня без поддержки прогибалась.",
  "Топ пост, сохранил в закладки!",
];

// Случайный выбор из массива. Не используем seedrandom — для seed-данных стабильность не критична.
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function randomPastDate(maxDaysAgo: number): Date {
  const ms = randInt(0, maxDaysAgo * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - ms);
}

async function clean(): Promise<void> {
  const db = getDb();
  // posts cascadи pull post_tags + comments → одного DELETE по slug достаточно.
  const result = await db
    .delete(posts)
    .where(like(posts.slug, "demo-%"))
    .returning({ id: posts.id });
  console.log(`[seed-demo] cleaned ${result.length} demo posts (with cascade: post_tags + comments)`);
}

async function seed(): Promise<void> {
  const db = getDb();

  const allUsers = await db.select().from(users);
  if (allUsers.length === 0) {
    console.error("[seed-demo] no users in DB; run /api/dev/login сначала чтобы создать devuser/devadmin");
    process.exit(1);
  }
  const allTags = await db.select().from(tags);
  const tagBySlug = new Map(allTags.map((t) => [t.slug, t]));

  console.log(`[seed-demo] ${allUsers.length} users, ${allTags.length} tags`);

  let postCounter = 0;
  let commentCounter = 0;

  for (const tpl of TEMPLATES) {
    // Подменяем slug-генератор: всегда префикс "demo-" — чтобы --clean ловил.
    const baseSlug = `demo-${slugify(tpl.title)}`.slice(0, 70);
    const slug = await uniqueSlug(baseSlug);

    const author = pick(allUsers);
    const pubAt = randomPastDate(30);
    const editorDoc = { time: pubAt.getTime(), version: "2.30.0", blocks: tpl.blocks } as never;

    const coverUrl = tpl.withCover ? extractCoverUrl(editorDoc) : null;
    const contentHtml = sanitize(renderBlock(editorDoc));
    const excerpt = extractPlainText(editorDoc).slice(0, 200);

    // 5% постов делаем скрытыми админом, 5% — archived, 90% — published.
    const roll = Math.random();
    const isHidden = roll < 0.05;
    const isArchived = !isHidden && roll < 0.10;

    const postId = newId();
    await db.insert(posts).values({
      id: postId,
      authorId: author.id,
      slug,
      title: tpl.title,
      excerpt,
      content: tpl.blocks as never,
      contentHtml,
      coverUrl,
      status: isArchived ? "archived" : "published",
      pubAt: isArchived ? null : pubAt,
      createdAt: pubAt,
      updatedAt: pubAt,
      hiddenByAdminAt: isHidden ? new Date(pubAt.getTime() + 60 * 60 * 1000) : null,
      hiddenByAdminId: isHidden
        ? (allUsers.find((u) => u.role === "admin")?.id ?? author.id)
        : null,
    });

    // Тэги: 1-3 случайных из tpl.tags (которые существуют в БД).
    const tagsForPost = tpl.tags
      .map((s) => tagBySlug.get(s))
      .filter((t): t is NonNullable<typeof t> => t != null);
    const pickedTags = pickN(tagsForPost, randInt(1, Math.min(3, tagsForPost.length || 1)));
    if (pickedTags.length > 0) {
      await db.insert(postTags).values(pickedTags.map((t) => ({ postId, tagId: t.id })));
    }

    postCounter++;

    // Комменты: 0-15 на пост, кривое распределение чтобы были и горячие, и пустые.
    // ~20% постов — 0-1 коммент; ~60% — 2-7; ~20% — 8-15.
    const popRoll = Math.random();
    let commentN: number;
    if (popRoll < 0.20) commentN = randInt(0, 1);
    else if (popRoll < 0.80) commentN = randInt(2, 7);
    else commentN = randInt(8, 15);

    // Hidden/archived постам — мало комментов или совсем нет.
    if (isHidden || isArchived) commentN = Math.min(commentN, 2);

    for (let i = 0; i < commentN; i++) {
      const commentAuthor = pick(allUsers);
      // Коммент позже поста, разлёт до 25 дней после pubAt (но не в будущем).
      const commentMaxOffset = Math.min(
        25 * 24 * 60 * 60 * 1000,
        Date.now() - pubAt.getTime(),
      );
      const createdAt = new Date(pubAt.getTime() + randInt(60 * 1000, commentMaxOffset));

      await db.insert(comments).values({
        id: newId(),
        postId,
        authorId: commentAuthor.id,
        contentText: pick(COMMENT_TEMPLATES),
        createdAt,
      });
      commentCounter++;
    }
  }

  console.log(`[seed-demo] created ${postCounter} posts + ${commentCounter} comments`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[seed-demo] DATABASE_URL required");
    process.exit(1);
  }
  if (doClean) await clean();
  if (doSeed) await seed();
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
