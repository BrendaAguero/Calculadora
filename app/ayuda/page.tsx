import Link from 'next/link';
import { PublicPage, proseClass } from '@/components/public-page';
import { CONTACT_EMAIL } from '@/lib/legal';

export const metadata = { title: 'Ayuda · Calculadora Emprender' };

// Guías paso a paso. El id de cada una se usa en las ayudas de cada pantalla (/ayuda#id).
const GUIDES: { id: string; title: string; steps: React.ReactNode[] }[] = [
  {
    id: 'empezar', title: 'Primeros pasos', steps: [
      <>Cargá tus <Link href="/materials">materiales</Link> con lo que pagaste y la cantidad (por ejemplo, 25 kg de yeso a $20.000).</>,
      <>Si usás siempre la misma mezcla, guardala como <Link href="/formulas">fórmula</Link>.</>,
      <>Registrá tus <Link href="/gestion/moldes">moldes</Link> con los gramos que entran en cada uno.</>,
      <>Usá <Link href="/calcular">Calcular</Link> para saber cuánto material necesitás, cuánto te cuesta y a qué precio vender.</>,
      <>Cuando quieras ordenar tu negocio, sumá <Link href="/gestion/productos">productos</Link>, <Link href="/stock">stock</Link>, <Link href="/produccion">producción</Link> y <Link href="/ventas">ventas</Link>.</>,
    ],
  },
  {
    id: 'calcular', title: 'Calcular una tanda', steps: [
      <>Elegí el modo: <strong>Fácil</strong> (lo mínimo), <strong>Estándar</strong> (suma packaging y otros costos) o <strong>Personalizado</strong> (control total). Podés cambiar sin perder lo cargado.</>,
      <>Poné cuántas piezas vas a hacer y los gramos por pieza. ¿No sabés cuánto lleva el molde? Llenalo con agua y pesala: esos gramos son los de material por pieza.</>,
      <>Revisá el porcentaje de agua: 70 %, 75 % y 80 % son referencias; si elegís una fórmula guardada, se usa la suya.</>,
      <>Indicá la ganancia que querés. El precio sugerido es una referencia: vos decidís el precio final.</>,
      <>Guardá el cálculo para verlo después en <Link href="/historial">Historial</Link>, duplicarlo o recalcularlo con precios nuevos.</>,
    ],
  },
  {
    id: 'mezclas', title: 'Resina, Jesmonite y Cemento', steps: [
      <>En <Link href="/calcular">Calcular</Link> elegí arriba la actividad: Resina, Jesmonite o Cemento.</>,
      <>Tocá «Ajustar» en «Mi receta» para poner tu proporción (por ejemplo, Jesmonite AC100: 1 de líquido por 2,5 de polvo), el % de pigmento, la merma y el precio por kg de cada material. Con «Guardar como mis valores» la próxima vez arranca así.</>,
      <>Poné cuántas piezas y el agua que entra en el molde: la app te dice cuántos gramos preparar de cada componente, el costo por pieza y el precio sugerido.</>,
      <>Estas calculadoras vienen con la Mensualidad Plus o comprando la actividad.</>,
    ],
  },
  {
    id: 'taller', title: 'Taller: colores, pruebas y tiempos', steps: [
      <>¿Te salió mal una pieza? En <Link href="/ayuda/problemas">¿Qué le pasó a mi pieza?</Link> ves por qué pasa y cómo evitarlo (burbujas, resina pegajosa, fisuras y más). Es gratis.</>,
      <>Con <Link href="/colores">Recetas de color</Link> guardás cuánto pigmento lleva cada color y la app te dice cuánto poner para otra cantidad de mezcla.</>,
      <>En el <Link href="/cuaderno">Cuaderno de pruebas</Link> anotás cada colada (material, proporción, color, temperatura) y cómo salió, con foto.</>,
      <>Los <Link href="/temporizadores">Temporizadores</Link> te avisan cuándo desmoldar y cuándo está curada la pieza. Suenan mientras la app esté abierta.</>,
      <>Estos tres son módulos que se compran sueltos en <Link href="/access">Mi acceso</Link>, o vienen con la Mensualidad Plus.</>,
    ],
  },
  {
    id: 'stock', title: 'Stock', steps: [
      <>En <Link href="/stock">Stock</Link> ves materias primas y productos terminados, con su cantidad, mínimo y valor.</>,
      <>El stock se mueve solo cuando registrás producción, compras o ventas. Si necesitás corregirlo, usá un ajuste desde el detalle del ítem.</>,
      <>Poné un mínimo para recibir el aviso de que te estás quedando sin algo.</>,
      <>Puede quedar en negativo si producís o vendés más de lo cargado: es un aviso para que revises, no un error.</>,
    ],
  },
  {
    id: 'produccion', title: 'Producción', steps: [
      <>Entrá a <Link href="/produccion/nueva">Nueva producción</Link>, elegí el producto y la cantidad que fabricaste.</>,
      <>Se descuentan los materiales del stock y se suman las piezas terminadas.</>,
      <>El costo de esa producción queda guardado y se usa para calcular la ganancia de tus ventas y el valor del stock.</>,
    ],
  },
  {
    id: 'compras', title: 'Compras y proveedores', steps: [
      <>Cargá tus <Link href="/proveedores">proveedores</Link> una sola vez.</>,
      <>En <Link href="/compras/nueva">Nueva compra</Link> anotá qué compraste, a quién y a qué precio. El stock y el precio del material se actualizan solos.</>,
      <>Usá <Link href="/compras/comparar">Comparar</Link> para ver qué proveedor te vende más barato cada material.</>,
    ],
  },
  {
    id: 'ventas', title: 'Ventas y resumen', steps: [
      <>En <Link href="/ventas/nueva">Nueva venta</Link> elegí los productos, el precio, descuentos y comisiones (por ejemplo, la de Mercado Pago o de una feria).</>,
      <>La aplicación calcula la ganancia y el margen de cada venta con el costo de producción.</>,
      <>Si te equivocaste, anulá la venta: el stock vuelve y queda registrado.</>,
      <>En <Link href="/resumen">Resumen</Link> ves ventas, costos, ganancias, producción y stock por período.</>,
    ],
  },
];

const FAQ: [string, React.ReactNode][] = [
  ['¿Mis datos los puede ver otra persona?', <>No. Cada cuenta solo puede ver sus propios datos. Más detalles en la <Link href="/legal/privacidad">Política de privacidad</Link>.</>],
  ['¿Qué diferencia hay entre la Edición Personal y la Mensualidad Plus?', <>La <strong>Edición Personal</strong> se paga una sola vez: calculadora, materiales, fórmulas, moldes y productos, 2 aparatos, con publicidad. Si vendés, sumale el <strong>Pack Ventas y Stock</strong> (ventas, resumen, stock, producción, compras y proveedores), también de pago único. Para el taller hay módulos sueltos: <strong>Recetas de color</strong>, <strong>Cuaderno de pruebas</strong> y <strong>Temporizadores</strong>. La <strong>Mensualidad Plus</strong> se suma por mes: sin publicidad, todas las actividades, el Pack Ventas y Stock y los módulos del taller, sin límites y modo sin conexión. Mirá tu acceso en <Link href="/access">Mi acceso</Link>.</>],
  ['¿Qué actividades tengo?', <>La primera vez que entrás elegís tu <strong>actividad principal</strong> (Yeso, Resina, Jesmonite o Cemento): viene incluida. Tu segunda actividad sale siempre a mitad de precio y las siguientes a precio normal; se compran aparte en <Link href="/access#actividades">Mi acceso</Link> y queda para siempre. Con la Mensualidad Plus tenés todas.</>],
  ['¿Puedo revender la app?', <>Sí. En <Link href="/revendedora">Revendedora</Link> activás el modo gratis, comprás licencias de a una o en paquetes con descuento y se las asignás a tus clientas con su correo. Cuando lo aprobamos, le llega su clave por correo. Ahí mismo tenés recursos de venta y el contacto para acelerar las aprobaciones.</>],
  ['¿Qué pasa si doy de baja Plus?', <>Seguís con tu Edición Personal. <strong>No se borra nada.</strong> Si tenías más cosas que los límites de la Edición Personal, las seguís viendo, pero no podés crear nuevas hasta liberar lugar o volver a Plus.</>],
  ['¿Cómo doy de baja la Mensualidad Plus?', <>Desde el <Link href="/baja">Botón de baja</Link> o en <Link href="/access">Mi acceso</Link> → «Cancelar renovación». No se te vuelve a cobrar y seguís teniendo el plan hasta que termina el mes pagado.</>],
  ['¿En cuántos aparatos la puedo usar?', <>En 2 (por ejemplo, tu celular y tu computadora). Si cambiás de aparato, liberá el viejo en <Link href="/access#aparatos">Mi acceso</Link>. Si necesitás más, comprá un «Aparato extra».</>],
  ['¿Cómo entro?', <>Con tu <strong>clave de acceso</strong>: te la mandamos por correo cuando se aprueba tu compra (online, por transferencia o por MercadoLibre). La escribís una vez en cada aparato y después la app queda abierta.</>],
  ['¿Puedo usar la app sin internet?', <>Sí, con la <Link href="/access#emprendedor">Mensualidad Plus</Link>. Instalá la app y abrila una vez con internet: guarda tus pantallas. Sin conexión ves tus datos (como estaban la última vez) y podés hacer cálculos y cargar ventas: se suben solos cuando vuelve internet. Para cambiar otras cosas (materiales, stock, productos) necesitás conexión. Tenés que conectarte al menos una vez cada 30 días.</>],
  ['¿Puedo bloquear la app con huella o PIN?', <>Sí. En <Link href="/profile">Mi perfil</Link> → «Bloqueo de la app». Al abrirla (o volver después de 5 minutos) te pide tu huella, tu cara o un PIN. Si lo olvidás, entrás de nuevo con tu clave.</>],
  ['Me llegó un aviso de que mi cuenta se usa en dos lugares', <>Si fuiste vos (por ejemplo, con datos del celular la ubicación puede variar), tocá «Sí, fui yo». Si no, tocá «No fui yo»: cerramos la sesión en todos tus aparatos y te mandamos una clave nueva por correo.</>],
  ['¿Cómo pago?', <>Con Mercado Pago (tarjeta, dinero en cuenta y otros medios). La compra se activa sola cuando el pago se aprueba. La suscripción mensual se cobra sola cada mes: para eso Mercado Pago te pide el email de tu cuenta de Mercado Pago.</>],
  ['Pagué y no se activó', <>Si pagaste en efectivo, puede tardar hasta que se acredite. Si pasaron más de 2 horas, escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> con el número de operación de Mercado Pago.</>],
  ['Me arrepentí de una compra', <>Tenés 10 días corridos para revocarla sin costo desde el <Link href="/arrepentimiento">Botón de arrepentimiento</Link>.</>],
  ['No me llegó la clave', <>Revisá spam y promociones (buscá «Tu clave de acceso»). Si sigue sin llegar, escribinos desde el email con el que compraste y te la reenviamos.</>],
  ['Veo un error con un código', <>Anotá el código o sacá una captura y mandanosla a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>: nos ayuda a encontrar el problema rápido.</>],
  ['¿Cómo borro mi cuenta?', <>Escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> desde el email de tu cuenta. Te explicamos qué se borra y qué se conserva por obligación legal.</>],
];

export default function HelpPage() {
  return (
    <PublicPage>
      <h1 className="text-2xl font-bold">Ayuda</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Guías cortas y respuestas a las preguntas más comunes.</p>

      <nav aria-label="Guías" className="mt-6 flex flex-wrap gap-2">
        {GUIDES.map((g) => <a key={g.id} href={`#${g.id}`} className="rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700">{g.title}</a>)}
        <a href="#preguntas" className="rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700">Preguntas frecuentes</a>
      </nav>

      <div className={`mt-6 ${proseClass}`}>
        {GUIDES.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-6">
            <h2>{g.title}</h2>
            <ol>{g.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
          </section>
        ))}

        <section id="preguntas" className="scroll-mt-6">
          <h2>Preguntas frecuentes</h2>
          <div className="mt-2 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-4 py-3">
                <summary className="cursor-pointer list-none font-medium text-neutral-900 marker:hidden dark:text-white">
                  <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden="true">›</span>{q}
                </summary>
                <div className="mt-2 pl-4">{a}</div>
              </details>
            ))}
          </div>
        </section>

        <section>
          <h2>¿Necesitás más ayuda?</h2>
          <p>Escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </section>
      </div>
    </PublicPage>
  );
}
