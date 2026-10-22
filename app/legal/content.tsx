import Link from 'next/link';
import { APP_NAME, CONTACT_EMAIL, OWNER_ADDRESS, OWNER_CUIT, OWNER_NAME } from '@/lib/legal';

// Textos legales, armados según la normativa argentina principal: Ley 24.240 (Defensa del Consumidor, art. 34
// revocación), Res. SCI 424/2020 (botón de arrepentimiento), Res. SCI 316/2018 (botón de baja), Ley 25.326 y
// Disp. DNPDP 10/2008 (datos personales). Conviene que los revise un profesional cuando sea posible.
type LegalDoc = { title: string; summary: string; body: React.ReactNode };

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terminos: {
    title: 'Términos y condiciones de uso',
    summary: 'Las reglas para usar la aplicación.',
    body: (
      <>
        <h2>1. Quién presta el servicio</h2>
        <p>{APP_NAME} es una aplicación web prestada por {OWNER_NAME}, CUIT {OWNER_CUIT}, con domicilio en {OWNER_ADDRESS ? `${OWNER_ADDRESS}, ` : ''}República Argentina. Contacto: <Mail />.</p>
        <h2>2. Qué es la aplicación</h2>
        <p>Es una herramienta para que emprendedoras y emprendedores calculen cantidades, costos, precios y ganancias, y organicen materiales, fórmulas, moldes y productos. Con el Pack Ventas y Stock también organizan stock, producción, compras y ventas.</p>
        <p>Los resultados son estimaciones que dependen de los datos que cargás: son una ayuda para decidir, así que revisalos antes de usarlos. No reemplazan el asesoramiento contable, impositivo ni técnico de un profesional.</p>
        <h2>3. Cuenta</h2>
        <ul>
          <li>Para usar la aplicación entrás con una clave de acceso personal que te llega por correo. No la compartas: si alguien más la usa, ocupa uno de tus aparatos. Tenés que ser mayor de 18 años o contar con autorización de tu madre, padre o tutor.</li>
          <li>Sos responsable de mantener segura tu contraseña y de lo que se haga con tu cuenta.</li>
          <li>Solo pueden entrar los emails aprobados (por una compra o por la administración). La Edición Personal se usa en hasta 2 aparatos y no se puede transferir ni compartir.</li>
        </ul>
        <h2>4. Uso permitido</h2>
        <p>No está permitido: usar la aplicación para fines ilegales, intentar acceder a datos de otras personas, alterar su funcionamiento, automatizar accesos masivos, revender el servicio o crear cuentas falsas. Si esto ocurre, podemos suspender la cuenta; te avisaremos el motivo por email y podés escribirnos para revisarlo.</p>
        <h2>5. Planes y pagos</h2>
        <p>Hay una versión gratis con límites. Para usar todo podés comprar la Edición Personal (pago único) o contratar Personal Plus (por mes o por año); algunas funciones puntuales requieren un extra. Las condiciones de cada compra están en las <Link href="/legal/compras">Condiciones de compra, suscripciones y reembolsos</Link>.</p>
        <h2>6. Tus datos</h2>
        <p>Los datos que cargás son tuyos y son privados. Cómo los tratamos está explicado en la <Link href="/legal/privacidad">Política de privacidad</Link>. Si un plan vence, tus datos no se borran.</p>
        <h2>7. Disponibilidad y cambios</h2>
        <p>Trabajamos para que la aplicación funcione siempre, pero puede haber interrupciones por mantenimiento o fallas de terceros (hosting, base de datos, Mercado Pago). Podemos mejorar o cambiar funciones. Si cambiamos estos términos, lo avisaremos en la aplicación con anticipación; los cambios no afectan compras ya realizadas.</p>
        <h2>8. Propiedad intelectual</h2>
        <p>El diseño, el código y los textos de la aplicación pertenecen a su titular. Tus datos y tus fórmulas siguen siendo tuyos.</p>
        <h2>9. Baja del servicio y de la cuenta</h2>
        <p>Podés dar de baja la suscripción en cualquier momento desde el <Link href="/legal/compras#baja">Botón de baja</Link>, tan fácil como la contrataste. También podés pedir la baja de tu cuenta en cualquier momento escribiendo a <Mail /> desde el email de tu cuenta. Ver la <Link href="/legal/privacidad">Política de privacidad</Link> para saber qué datos se conservan por obligación legal.</p>
        <h2>10. Ley aplicable y reclamos</h2>
        <p>Se aplican las leyes de la República Argentina, incluida la Ley 24.240 de Defensa del Consumidor. Nada de estos términos limita los derechos que te da esa ley. Ante cualquier reclamo podés escribirnos a <Mail />, y también acudir a la autoridad de defensa del consumidor de tu jurisdicción o a <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor" target="_blank" rel="noreferrer">Defensa del Consumidor de la Nación</a>.</p>
      </>
    ),
  },
  privacidad: {
    title: 'Política de privacidad',
    summary: 'Qué datos guardamos, para qué y cuáles son tus derechos.',
    body: (
      <>
        <h2>1. Responsable</h2>
        <p>{OWNER_NAME}, CUIT {OWNER_CUIT}, es responsable de la base de datos. Contacto: <Mail />. Tratamos tus datos según la Ley 25.326 de Protección de Datos Personales.</p>
        <h2>2. Qué datos guardamos</h2>
        <ul>
          <li><strong>De tu cuenta:</strong> nombre, email, fecha de aceptación de los términos y fecha de alta.</li>
          <li><strong>De tu negocio:</strong> lo que cargás (materiales, precios, fórmulas, moldes, productos, stock, producción, compras, proveedores, ventas y cálculos).</li>
          <li><strong>De tus compras:</strong> qué compraste, el monto, la fecha y el número de operación de Mercado Pago. <strong>No</strong> guardamos datos de tarjetas: el pago lo procesa Mercado Pago.</li>
          <li><strong>Si sos afiliada:</strong> tu código, las compras atribuidas, comisiones y los datos que nos des para pagarte.</li>
          <li><strong>De tus aparatos:</strong> un identificador de cada aparato donde entrás, su tipo (por ejemplo, «Android · Chrome»), cuándo lo usaste por última vez y la <strong>ciudad aproximada</strong> según tu conexión a internet (nunca tu dirección ni tu ubicación exacta). Lo usamos para respetar el límite de aparatos y avisarte si tu cuenta se usa en dos lugares lejanos al mismo tiempo.</li>
          <li><strong>Técnicos:</strong> registros de errores y de seguridad necesarios para que la aplicación funcione y para detectar abusos.</li>
        </ul>
        <h2>3. Para qué los usamos</h2>
        <p>Solo para prestar el servicio: mostrarte tu información, procesar compras y activaciones, pagar comisiones, darte soporte, mantener la seguridad y cumplir obligaciones legales. No vendemos ni alquilamos tus datos y no los usamos para publicidad de terceros.</p>
        <h2>4. Quién más los procesa</h2>
        <p>Usamos proveedores que guardan o procesan datos por cuenta nuestra: Supabase (base de datos y acceso), Vercel (alojamiento de la aplicación y conteo anónimo de visitas) y Mercado Pago (pagos). Algunos de estos servicios guardan datos fuera de Argentina (por ejemplo, en Estados Unidos o Brasil), con medidas de seguridad adecuadas; al usar la aplicación aceptás esa transferencia, que es necesaria para prestar el servicio.</p>
        <h2>5. Privacidad dentro de la aplicación</h2>
        <p>Tus datos son privados por defecto: otras personas usuarias no pueden verlos. La administración puede acceder a la información de cuentas, compras y afiliadas para dar soporte, activar compras y prevenir fraudes, y cada acción queda registrada.</p>
        <h2>6. Cuánto tiempo los guardamos</h2>
        <p>Mientras tengas la cuenta. Si pedís la baja, borramos o anonimizamos tus datos, salvo los registros de compras y pagos, que debemos conservar por obligaciones contables e impositivas.</p>
        <h2>7. Tus derechos</h2>
        <p>Podés pedir gratis acceder, corregir, actualizar o eliminar tus datos escribiendo a <Mail /> desde el email de tu cuenta. Respondemos el pedido de acceso dentro de los 10 días corridos y los de corrección o eliminación dentro de los 5 días hábiles, como indica la ley.</p>
        <p className="text-sm">La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales. Más información en <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noreferrer">argentina.gob.ar/aaip</a>.</p>
        <h2>8. Cookies</h2>
        <p>Usamos solo cookies necesarias: la de tu sesión y, si llegaste por el enlace de una afiliada, la que guarda su código por 30 días. Tu preferencia de tema (claro u oscuro) y el bloqueo opcional con PIN o huella se guardan solo en tu navegador (el PIN, cifrado; la huella o la cara nunca salen de tu aparato). También usamos una cookie que identifica tu aparato para el límite de aparatos. Con Personal Plus, la app guarda en tu aparato las pantallas que abrís y lo que cargás sin conexión, para poder usarla sin internet; se borra al cerrar sesión (lo que no se haya subido queda en el aparato hasta que vuelvas a entrar). No usamos cookies de publicidad: el aviso de la versión gratis es una imagen fija, sin seguimiento. Para saber qué pantallas se usan más, contamos visitas con Vercel Web Analytics, que no usa cookies ni guarda datos que te identifiquen.</p>
        <h2>9. Seguridad</h2>
        <p>La conexión es cifrada, cada cuenta solo puede leer sus propios datos y las claves de los servicios nunca se exponen en el navegador. Cuando creás tu contraseña, revisamos que no haya aparecido en filtraciones conocidas consultando el servicio Pwned Passwords: solo se envía un fragmento de una huella cifrada, nunca la contraseña. Si detectamos un incidente que afecte tus datos, te avisaremos.</p>
      </>
    ),
  },
  compras: {
    title: 'Condiciones de compra, suscripciones y reembolsos',
    summary: 'Edición Personal, extras, Personal Plus, arrepentimiento y baja.',
    body: (
      <>
        <h2>1. Qué se puede comprar</h2>
        <ul>
          <li><strong>Edición Personal:</strong> pago único y permanente (no vence). Incluye la calculadora de una actividad principal a elección (Yeso, Resina, Jesmonite o Cemento decorativo), que se elige la primera vez que entrás y no se puede cambiar después; guardar materiales, fórmulas, moldes, productos y cálculos, con hasta 100 materiales, 50 productos, 30 fórmulas y 30 moldes, el uso en 2 aparatos y un aviso publicitario propio. Incluye también Recetas de color y Cuaderno de pruebas. Recibe actualizaciones (correcciones y mantenimiento); puede recibir alguna mejora, pero no se garantizan funciones nuevas, que son parte de Personal Plus. Funciona con internet.</li>
          <li><strong>Paquetes para revendedoras:</strong> licencias de la Edición Personal a precio de revendedora, de a una o en paquetes de 5, 10 o 20 con mayor descuento, para revender. Cada licencia se usa al asignarla al correo de una clienta y se descuenta cuando la administración lo aprueba; la clienta recibe su clave por correo. La revendedora fija su precio de venta y es responsable de su relación comercial con sus clientas.</li>
          <li><strong>Actividades extra:</strong> pago único y permanente por cada actividad. La segunda actividad cuesta la mitad del precio normal; las siguientes, el precio normal publicado en la app.</li>
          <li><strong>Pack Ventas y Stock:</strong> pago único y permanente. Suma las funciones de gestión: ventas, resumen, stock, producción, compras y proveedores. Se compra desde la tienda de la app. Viene incluido en Personal Plus mientras esté activa.</li>
          <li><strong>Herramientas del taller</strong> (Recetas de color y Cuaderno de pruebas): vienen incluidas en la Edición Personal y en Personal Plus. Quien las haya comprado sueltas antes las conserva. Los Temporizadores de curado son gratis. Los tiempos y consejos que muestra la app son referencias generales: siempre valen las indicaciones del fabricante de cada material.</li>
          <li><strong>Extras:</strong> pago único y permanentes (por ejemplo, «Aparato extra» para usar la app en un aparato más).</li>
          <li><strong>Personal Plus:</strong> suscripción mensual (cobro automático) o anual (un pago por 12 meses), como alternativa a comprar la Edición Personal (no hace falta tenerla). Mientras esté activa incluye todo lo de la Edición Personal y las funciones nuevas que se sumen a la app, y además quita la publicidad, desbloquea todas las actividades, el Pack Ventas y Stock, los módulos del taller y los demás módulos disponibles, elimina los límites de altas y permite usar la app sin conexión.</li>
        </ul>
        <p>El precio final se muestra siempre antes de pagar. Los precios están en pesos argentinos e incluyen los impuestos que correspondan. Según el medio de pago el precio de la Edición Personal puede variar (online, transferencia o MercadoLibre).</p>
        <h2>2. Pago, aprobación y acceso</h2>
        <p>Si comprás online con Mercado Pago, tu email queda aprobado cuando Mercado Pago confirma el pago. Si pagás por transferencia o por MercadoLibre, aprobamos tu email después de verificar el pago. Al aprobarse, te mandamos por correo tu clave de acceso para entrar a la app. Si el pago queda pendiente, el acceso se habilita cuando se acredita; si se rechaza, no se cobra nada.</p>
        <h2>3. Aparatos</h2>
        <p>La Edición Personal se usa en hasta 2 aparatos (por ejemplo, tu celular y tu computadora). Podés liberar un aparato que ya no uses desde «Mi acceso» o sumar aparatos con el extra «Aparato extra». La cuenta es personal: no se puede compartir ni revender.</p>
        <h2>4. Personal Plus</h2>
        <ul>
          <li><strong>Mensual:</strong> se paga con <strong>cobro automático</strong> de Mercado Pago: autorizás un cobro por mes, del mismo monto, hasta que la des de baja.</li>
          <li><strong>Anual:</strong> un solo pago por 12 meses, sin renovación automática. Al terminar podés renovarla.</li>
          <li>Podés darla de baja cuando quieras desde el <Link href="/baja">Botón de baja</Link> o desde <Link href="/access">Mi acceso</Link>: no se te vuelve a cobrar y sigue activa hasta el final del mes pagado.</li>
          <li>Cuando termina, volvés a lo que tengas: la Edición Personal si la compraste, o la versión gratis, con su publicidad y sus límites. <strong>Tus datos no se borran</strong>; solo se limitan las nuevas altas que superen el límite.</li>
        </ul>
        <h2>5. Botón de arrepentimiento (10 días)</h2>
        <p>Podés revocar cualquier compra dentro de los 10 días corridos desde que la hiciste, sin dar motivos y sin costo, como establece el artículo 34 de la Ley 24.240. Hacelo desde el <Link href="/arrepentimiento">Botón de arrepentimiento</Link> (no hace falta iniciar sesión) o escribiendo a <Mail />. Te damos un código de trámite en el momento. Devolvemos el total por el mismo medio de pago y se desactiva lo comprado. Las compras hechas en MercadoLibre también pueden gestionarse por las herramientas de MercadoLibre.</p>
        <h2 id="baja">6. Botón de baja</h2>
        <p>Podés dar de baja la suscripción mensual en cualquier momento, sin dar motivos, desde el <Link href="/baja">Botón de baja</Link>, como establece la Resolución 316/2018 de la Secretaría de Comercio. Con tu sesión iniciada la baja es inmediata (también se cancela en Mercado Pago) y te damos un código de baja en el momento. Si no podés entrar a tu cuenta, el mismo botón te deja pedirla con tu nombre y email.</p>
        <h2>7. Después de los 10 días</h2>
        <p>La Edición Personal y los extras son permanentes y no se reembolsan después de los 10 días, salvo falla del servicio que nos impida prestarlo. Personal Plus se puede dar de baja en cualquier momento; el mes ya pagado no se reembolsa.</p>
        <h2>8. Contracargos y fraude</h2>
        <p>Si un pago se anula, se devuelve o se desconoce ante Mercado Pago, lo que se activó con ese pago se desactiva.</p>
        <h2>9. Factura y reclamos</h2>
        <p>Por cada compra corresponde una factura. Si no la recibiste o tenés un problema con una compra, escribinos a <Mail /> con el número de operación de Mercado Pago.</p>
      </>
    ),
  },
  afiliadas: {
    title: 'Condiciones del programa de afiliadas',
    summary: 'Cómo se ganan y se cobran las comisiones.',
    body: (
      <>
        <h2>1. Cómo participar</h2>
        <p>Cualquier persona con cuenta puede pedir sumarse desde <Link href="/afiliados">Programa de afiliadas</Link>. La administración revisa cada solicitud y puede aprobarla o rechazarla. Al aprobarla recibís un código y un enlace personal.</p>
        <h2>2. Comisiones</h2>
        <ul>
          <li>Ganás un porcentaje (15 % o 20 %, según se te asigne) de cada compra pagada que llegue con tu código o enlace. El enlace guarda tu código por 30 días en el navegador de quien lo abre.</li>
          <li><strong>PRO:</strong> si lográs 10 ventas válidas por mes durante 3 meses seguidos, tu comisión pasa al 25 %.</li>
          <li>La comisión se calcula sobre el monto efectivamente pagado. En la suscripción mensual se genera con el primer pago.</li>
          <li>Cada comisión queda <strong>retenida 11 días</strong> (el plazo de arrepentimiento más un margen). Si la compra se devuelve o anula, la comisión se anula. Después pasa a disponible.</li>
        </ul>
        <h2>3. Retiros</h2>
        <p>Podés pedir el retiro cuando tengas al menos $20.000 disponibles ($10.000 si sos PRO). Se paga por transferencia a los datos que indiques; la administración puede pedirte datos para verificar tu identidad y emitir los comprobantes que correspondan. Sos responsable de tus obligaciones impositivas por lo que cobres.</p>
        <h2>4. Qué no está permitido</h2>
        <ul>
          <li>Usar tu propio código o crear cuentas falsas.</li>
          <li>Publicidad engañosa: prometer funciones o descuentos que no existen, o hacerte pasar por la aplicación oficial.</li>
          <li>Spam o envío de mensajes no solicitados.</li>
          <li>Pagar publicidad usando el nombre de la aplicación sin autorización.</li>
        </ul>
        <p>Si se detecta alguna de estas prácticas, las comisiones involucradas se anulan y la cuenta de afiliada puede suspenderse.</p>
        <h2>5. Cambios y baja</h2>
        <p>Podemos cambiar estas condiciones avisando con anticipación; las comisiones ya generadas se respetan. Podés dejar el programa cuando quieras escribiendo a <Mail />; se te paga lo disponible si llega al mínimo.</p>
      </>
    ),
  },
};
