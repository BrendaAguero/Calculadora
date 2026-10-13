// Problemas comunes al colar piezas: causa probable y cómo evitarlo.
// Se usa en /ayuda/problemas (gratis) y como etiquetas en el Cuaderno de pruebas.
export type Problem = { id: string; label: string; materials: string[]; why: string[]; fix: string[] };

export const PROBLEMS: Problem[] = [
  {
    id: 'burbujas', label: 'Burbujas', materials: ['Yeso', 'Resina', 'Jesmonite', 'Cemento'],
    why: [
      'Al mezclar rápido o batiendo se mete aire en la mezcla.',
      'El molde tiene rincones finos donde el aire queda atrapado.',
      'En resina: la mezcla está fría y espesa, y el aire no llega a subir.',
    ],
    fix: [
      'Mezclá despacio, con la espátula pegada al fondo, sin batir.',
      'Volcá en un hilo fino desde una esquina del molde, no de golpe en el medio.',
      'Pintá primero una capa fina sobre todo el molde con un pincel y después llená.',
      'Dale golpecitos al molde o ponelo sobre algo que vibre unos minutos.',
      'En resina: entibiá los frascos a baño María (cerrados) y pasá un soplete o encendedor por arriba para reventar las burbujas.',
    ],
  },
  {
    id: 'pegajosa', label: 'Quedó pegajosa o blanda', materials: ['Resina'],
    why: [
      'La proporción de A y B no fue exacta (sobre todo si mediste a ojo o por volumen cuando va por peso).',
      'No se mezcló lo suficiente: quedaron partes sin activar, muchas veces en los bordes del vaso.',
      'Hizo frío o había mucha humedad: la resina tarda mucho más o no termina de curar.',
      'Demasiado pigmento o un pigmento que no es para resina.',
    ],
    fix: [
      'Pesá cada parte en balanza y respetá la proporción del fabricante (por peso o por volumen, según diga).',
      'Mezclá 3 a 5 minutos raspando paredes y fondo; si podés, pasá la mezcla a un segundo vaso y mezclá otra vez.',
      'Trabajá entre 20 y 25 °C. Si hace frío, dejala curar en un lugar templado.',
      'No pases del 5 % al 10 % de pigmento (según la marca) y usá pigmentos para resina.',
      'Si quedó apenas pegajosa, a veces termina de curar con calor suave. Si está blanda, no tiene arreglo: hay que hacerla de nuevo.',
    ],
  },
  {
    id: 'no-fragua', label: 'No endurece o tarda mucho', materials: ['Yeso', 'Jesmonite', 'Cemento'],
    why: [
      'Demasiada agua (o líquido) en la mezcla.',
      'Yeso viejo o que tomó humedad en la bolsa.',
      'Mucho frío.',
    ],
    fix: [
      'Medí el agua y el polvo con balanza: respetá la proporción (en yeso suele ser 70 a 80 de agua cada 100 de yeso).',
      'Guardá el yeso bien cerrado, en un lugar seco. Si tiene grumos duros, no lo uses para piezas finas.',
      'Esperá más en días fríos antes de desmoldar.',
    ],
  },
  {
    id: 'fisuras', label: 'Fisuras o grietas', materials: ['Yeso', 'Resina', 'Jesmonite', 'Cemento'],
    why: [
      'Se secó demasiado rápido (sol, calefacción o viento).',
      'Desmoldaste antes de tiempo y la pieza se tensionó.',
      'En resina: colaste demasiado espesor de una vez y se recalentó.',
      'En cemento: faltó humedad durante el curado.',
    ],
    fix: [
      'Dejá secar a la sombra, lejos de estufas y corrientes de aire.',
      'Respetá el tiempo de desmolde de tu material.',
      'En resina gruesa: usá una resina para colada profunda o hacé capas finas, esperando entre una y otra.',
      'En cemento: tapá la pieza con un nylon o rociala con agua los primeros días.',
    ],
  },
  {
    id: 'quiebra', label: 'Se rompe al desmoldar', materials: ['Yeso', 'Jesmonite', 'Cemento'],
    why: [
      'Todavía no estaba firme.',
      'Partes muy finas o salientes sin refuerzo.',
      'Molde rígido o sin desmoldante.',
    ],
    fix: [
      'Esperá un poco más: en yeso, cuando deja de estar tibio ya está firme.',
      'En piezas finas sumá refuerzo (fibra o malla) o un poco más de espesor.',
      'Flexioná el molde de a poco, empezando por los bordes. En moldes rígidos usá desmoldante.',
    ],
  },
  {
    id: 'superficie', label: 'Superficie arenosa o con polvillo', materials: ['Yeso', 'Cemento'],
    why: [
      'Demasiada agua: se forma una capa blanda y polvorienta en la superficie.',
      'Mezcla mal integrada o que empezó a fraguar antes de volcar.',
    ],
    fix: [
      'Bajá un poco el agua y volcá apenas la mezcla esté lisa.',
      'No vuelvas a mezclar cuando ya empezó a espesar.',
      'Para dejarla lisa, lijá suave con lija al agua fina y sellá la pieza.',
    ],
  },
  {
    id: 'poros', label: 'Poros o agujeritos', materials: ['Jesmonite', 'Cemento', 'Yeso'],
    why: [
      'Aire atrapado contra la pared del molde.',
      'Mezcla demasiado espesa que no llega a copiar bien el molde.',
    ],
    fix: [
      'Pintá una primera capa fina con pincel, apretando contra el molde, y después llená.',
      'Vibrá o golpeá el molde varios minutos.',
      'Para tapar poros: prepará un poco de la misma mezcla bien líquida, pasala con el dedo o la espátula y lijá cuando seque.',
    ],
  },
  {
    id: 'color', label: 'Color desparejo o manchas', materials: ['Yeso', 'Resina', 'Jesmonite', 'Cemento'],
    why: [
      'El pigmento no se mezcló del todo.',
      'Distinta cantidad de pigmento entre tandas.',
      'En yeso y cemento: el secado desparejo deja zonas más claras.',
    ],
    fix: [
      'Mezclá el pigmento primero con el líquido (agua o parte A) y después sumá el resto.',
      'Pesá el pigmento y anotalo en tus Recetas de color para repetirlo igual.',
      'Dejá secar las piezas parejo, sin apoyarlas sobre una superficie que absorba de un solo lado.',
    ],
  },
  {
    id: 'amarillo', label: 'Se puso amarilla', materials: ['Resina'],
    why: [
      'El sol (rayos UV) amarillenta casi todas las resinas epoxi con el tiempo.',
      'Resina vieja o mal guardada.',
    ],
    fix: [
      'Usá resinas con protección UV para piezas que van al sol.',
      'Guardá los frascos cerrados, en un lugar oscuro y templado.',
      'Avisá a tus clientas que no dejen la pieza al sol.',
    ],
  },
  {
    id: 'calor', label: 'Se calentó mucho o humeó', materials: ['Resina'],
    why: [
      'Colaste mucha cantidad o mucho espesor de una vez: la resina genera calor al curar y se acelera sola.',
      'Hacía mucho calor.',
    ],
    fix: [
      'Prepará tandas chicas y respetá el espesor máximo que indica la marca.',
      'Para piezas gruesas usá resina de colada profunda o hacé capas.',
      'Si un vaso empieza a calentarse mucho, sacalo afuera, lejos de cosas que se quemen, y no lo toques.',
    ],
  },
  {
    id: 'deformada', label: 'Se deformó o se curvó', materials: ['Resina', 'Jesmonite', 'Cemento'],
    why: [
      'Desmoldaste antes de que terminara de curar.',
      'Se secó más rápido de un lado que del otro.',
      'Piezas finas y largas sin apoyo.',
    ],
    fix: [
      'Esperá el curado completo antes de desmoldar o apoyar peso.',
      'Dejala secar sobre una superficie plana, dándola vuelta si hace falta.',
      'En piezas finas, sumá refuerzo o un poco más de espesor.',
    ],
  },
];

export const problemLabel = (id: string) => PROBLEMS.find((p) => p.id === id)?.label ?? id;
