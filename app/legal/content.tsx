import Link from 'next/link';
import { APP_NAME, CONTACT_EMAIL, OWNER_CUIT, OWNER_NAME } from '@/lib/legal';

// Textos legales. Deben revisarse con la normativa argentina vigente antes del lanzamiento.
type LegalDoc = { title: string; summary: string; body: React.ReactNode };

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terminos: {
    title: 'Términos y condiciones de uso',
    summary: 'Las reglas para usar la aplicación.',
    body: (
      <>
        <h2>1. Quién presta el servicio</h2>
        <p>{APP_NAME} es una aplicación web prestada por {OWNER_NAME}, CUIT {OWNER_CUIT}, con domicilio en la República Argentina. Contacto: <Mail />.</p>
        <h2>2. Qué es la aplicación</h2>
        <p>Es una herramienta para que emprendedoras y emprendedores calculen cantidades, costos, precios y ganancias, y organicen materiales, fórmulas, moldes, productos, stock, producción, compras y ventas.</p>
        <p>Los resultados son estimaciones basadas en los datos que cargás. Revisalos antes de usarlos: no reemplazan el asesoramiento contable, impositivo ni técnico, y no nos hacemos responsables por decisiones tomadas solo en base a ellos.</p>
        <h2>3. Cuenta</h2>
        <ul>
          <li>Para usar la aplicación necesitás crear una cuenta con tu nombre y email. Tenés que ser mayor de 18 años o contar con autorización de tu madre, padre o tutor.</li>
          <li>Sos responsable de mantener segura tu contraseña y de lo que se haga con tu cuenta.</li>
          <li>Las licencias y compras quedan asociadas a tu cuenta, no a un dispositivo. No se pueden transferir ni compartir.</li>
        </ul>
        <h2>4. Uso permitido</h2>
        <p>No está permitido: usar la aplicación para fines ilegales, intentar acceder a datos de otras personas, alterar su funcionamiento, automatizar accesos masivos, revender el servicio o crear cuentas falsas. Si esto ocurre, podemos suspender la cuenta.</p>
        <h2>5. Planes y pagos</h2>
        <p>Algunas funciones requieren una compra (licencia, actividad, módulo o plan Emprendedor). Las condiciones de cada compra están en las <Link href="/legal/compras">Condiciones de compra, suscripciones y reembolsos</Link>.</p>
        <h2>6. Tus datos</h2>
        <p>Los datos que cargás son tuyos y son privados. Cómo los tratamos está explicado en la <Link href="/legal/privacidad">Política de privacidad</Link>. Si un plan vence, tus datos no se borran.</p>
        <h2>7. Disponibilidad y cambios</h2>
        <p>Trabajamos para que la aplicación funcione siempre, pero puede haber interrupciones por mantenimiento o fallas de terceros (hosting, base de datos, Mercado Pago). Podemos mejorar o cambiar funciones. Si cambiamos estos términos, lo avisaremos en la aplicación; los cambios no afectan compras ya realizadas.</p>
        <h2>8. Propiedad intelectual</h2>
        <p>El diseño, el código y los textos de la aplicación pertenecen a su titular. Tus datos y tus fórmulas siguen siendo tuyos.</p>
        <h2>9. Baja de la cuenta</h2>
        <p>Podés pedir la baja de tu cuenta en cualquier momento escribiendo a <Mail /> desde el email de tu cuenta. Ver la <Link href="/legal/privacidad">Política de privacidad</Link> para saber qué datos se conservan por obligación legal.</p>
        <h2>10. Ley aplicable y reclamos</h2>
        <p>Se aplican las leyes de la República Argentina, incluida la Ley 24.240 de Defensa del Consumidor. Ante cualquier reclamo, escribinos primero a <Mail />. También podés acudir a la autoridad de defensa del consumidor de tu jurisdicción o a <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor" target="_blank" rel="noreferrer">Defensa del Consumidor de la Nación</a>.</p>
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
          <li><strong>Técnicos:</strong> registros de errores y de seguridad necesarios para que la aplicación funcione y para detectar abusos.</li>
        </ul>
        <h2>3. Para qué los usamos</h2>
        <p>Solo para prestar el servicio: mostrarte tu información, procesar compras y activaciones, pagar comisiones, darte soporte, mantener la seguridad y cumplir obligaciones legales. No vendemos ni alquilamos tus datos y no los usamos para publicidad de terceros.</p>
        <h2>4. Quién más los procesa</h2>
        <p>Usamos proveedores que guardan o procesan datos por cuenta nuestra: Supabase (base de datos y acceso), Vercel (alojamiento de la aplicación) y Mercado Pago (pagos). Algunos de estos servicios pueden almacenar datos fuera de Argentina, con medidas de seguridad adecuadas.</p>
        <h2>5. Privacidad dentro de la aplicación</h2>
        <p>Tus datos son privados por defecto: otras personas usuarias no pueden verlos. La administración puede acceder a la información de cuentas, compras y afiliadas para dar soporte, activar compras y prevenir fraudes, y cada acción queda registrada.</p>
        <h2>6. Cuánto tiempo los guardamos</h2>
        <p>Mientras tengas la cuenta. Si pedís la baja, borramos o anonimizamos tus datos, salvo los registros de compras y pagos, que debemos conservar por obligaciones contables e impositivas.</p>
        <h2>7. Tus derechos</h2>
        <p>Podés pedir gratis acceder, corregir, actualizar o eliminar tus datos escribiendo a <Mail /> desde el email de tu cuenta. Respondemos el pedido de acceso dentro de los 10 días corridos y los de corrección o eliminación dentro de los 5 días hábiles, como indica la ley.</p>
        <p className="text-sm">La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales. Más información en <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noreferrer">argentina.gob.ar/aaip</a>.</p>
        <h2>8. Cookies</h2>
        <p>Usamos solo cookies necesarias: la de tu sesión y, si llegaste por el enlace de una afiliada, la que guarda su código por 30 días. Tu preferencia de tema (claro u oscuro) se guarda solo en tu navegador. No usamos cookies de publicidad.</p>
        <h2>9. Seguridad</h2>
        <p>La conexión es cifrada, cada cuenta solo puede leer sus propios datos y las claves de los servicios nunca se exponen en el navegador. Si detectamos un incidente que afecte tus datos, te avisaremos.</p>
      </>
    ),
  },
  compras: {
    title: 'Condiciones de compra, suscripciones y reembolsos',
    summary: 'Precios, plan Emprendedor, cancelaciones y botón de arrepentimiento.',
    body: (
      <>
        <h2>1. Qué se puede comprar</h2>
        <ul>
          <li><strong>Licencia Básico o Avanzado:</strong> pago único. Es permanente: no vence.</li>
          <li><strong>Actividades y módulos:</strong> pago único y permanentes.</li>
          <li><strong>Plan Emprendedor:</strong> habilita por un tiempo todas las funciones avanzadas y módulos. Requiere tener Básico o Avanzado. Se ofrece por 1 mes (suscripción mensual), 6 meses o 12 meses.</li>
        </ul>
        <p>El precio final, con los descuentos que correspondan, se muestra siempre antes de pagar. Los precios están en pesos argentinos e incluyen los impuestos que correspondan.</p>
        <h2>2. Pago y activación</h2>
        <p>Los pagos se hacen con Mercado Pago. La compra se activa cuando Mercado Pago confirma el pago aprobado. Si el pago queda pendiente (por ejemplo, en efectivo), se activa cuando se acredita. Si se rechaza, no se cobra nada.</p>
        <h2>3. Plan Emprendedor</h2>
        <ul>
          <li><strong>6 y 12 meses:</strong> si ya tenés Emprendedor vigente, el tiempo nuevo se suma al final del actual.</li>
          <li><strong>1 mes:</strong> es una suscripción mensual. Solo se contrata si no tenés Emprendedor vigente. Podés cancelar la renovación cuando quieras desde <Link href="/access">Mi acceso</Link>: el plan sigue activo hasta el final del mes pagado.</li>
          <li>Si con la suscripción mensual comprás 6 o 12 meses, el plan largo empieza cuando termina el mes pagado y la renovación mensual se cancela sola.</li>
          <li><strong>Actualizar</strong> a un plan más largo: se descuenta como crédito la parte no usada del plan actual. Los planes de cortesía no generan crédito.</li>
          <li>Cuando Emprendedor vence, volvés a tu plan base. <strong>Tus datos no se borran</strong>; solo se limitan las nuevas altas que superen el límite de tu plan.</li>
        </ul>
        <h2>4. Botón de arrepentimiento (10 días)</h2>
        <p>Podés revocar cualquier compra dentro de los 10 días corridos desde que la hiciste, sin dar motivos y sin costo, como establece el artículo 34 de la Ley 24.240. Hacelo desde el <Link href="/arrepentimiento">Botón de arrepentimiento</Link> (no hace falta iniciar sesión) o escribiendo a <Mail />. Te damos un código de trámite en el momento. Devolvemos el total por el mismo medio de pago y se desactiva lo comprado.</p>
        <h2>5. Después de los 10 días</h2>
        <p>Las licencias, actividades y módulos son permanentes y no se reembolsan después de los 10 días, salvo falla del servicio que nos impida prestarlo. En el plan Emprendedor podés cancelar la renovación en cualquier momento; el tiempo ya pagado no se reembolsa.</p>
        <h2>6. Contracargos y fraude</h2>
        <p>Si un pago se anula, se devuelve o se desconoce ante Mercado Pago, lo que se activó con ese pago se desactiva.</p>
        <h2>7. Factura y reclamos</h2>
        <p>Si necesitás comprobante o tenés un problema con una compra, escribinos a <Mail /> con el número de operación de Mercado Pago.</p>
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
          <li>La comisión se calcula sobre el monto efectivamente pagado.</li>
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
