// Textos de cuidado de cada material para la tarjeta que acompaña la venta (se pueden editar).
export const CARE_TEXTS: { id: string; label: string; title: string; tips: string[] }[] = [
  { id: 'yeso', label: 'Yeso', title: 'Tu pieza de yeso', tips: ['Es decorativa: no la mojes ni la dejes en exteriores.', 'Limpiala con un plumero o un paño seco.', 'Evitá golpes: el yeso es frágil.', 'Si tiene vela, no la dejes encendida sin mirar.'] },
  { id: 'resina', label: 'Resina', title: 'Tu pieza de resina', tips: ['Evitá el sol directo por mucho tiempo: puede amarillear.', 'Limpiala con un paño húmedo y jabón neutro.', 'No uses alcohol, solventes ni lavavajillas.', 'No apoyes cosas calientes encima.'] },
  { id: 'jesmonite', label: 'Jesmonite', title: 'Tu pieza de Jesmonite', tips: ['Limpiala con un paño apenas húmedo.', 'No uses productos abrasivos ni lavandina.', 'No la uses con alimentos salvo que te lo indiquemos.', 'Evitá golpes contra superficies duras.'] },
  { id: 'cemento', label: 'Cemento', title: 'Tu pieza de cemento', tips: ['Limpiala con un paño húmedo, sin productos fuertes.', 'El agua puede marcarla: secala si se moja.', 'Usá una base de fieltro para no rayar muebles.', 'Si es maceta, que tenga buen drenaje.'] },
  { id: 'velas', label: 'Velas', title: 'Tu vela', tips: ['La primera vez, dejala encendida hasta que se derrita toda la superficie.', 'Cortá la mecha a 5 mm antes de cada uso.', 'No la dejes encendida más de 3 horas ni sin mirar.', 'Lejos de cortinas, chicos y mascotas.'] },
];
