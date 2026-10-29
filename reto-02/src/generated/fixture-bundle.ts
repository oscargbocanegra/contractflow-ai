// Generated from immutable original fixtures; regenerate with npm run fixtures:bundle.
import type { Commercial, MessageDocument } from "../domain/contracts.js";
export const fixtureBundle: { masterCsv: string; commercials: Commercial[]; documents: MessageDocument[] } = {
  "masterCsv": "id_contrato,cliente,nit_cliente,pais,objeto,valor,moneda,fecha_inicio,fecha_fin,requiere_poliza,tipo_poliza,estado_poliza,comercial,ruta_sharepoint,fecha_registro,fuente\nCT-2025-018,Industrias Delta S.A.S.,890900111,CO,Soporte y mantenimiento plataforma SAP,420000000,COP,2025-07-01,2026-06-30,true,cumplimiento,vigente,Laura Gómez Restrepo,Contratos/2025/industrias-delta/CT-2025-018.pdf,2025-07-03,migracion\nCT-2026-002,Distribuidora Caribe S.A.S.,800222333,CO,Desarrollo de portal de pedidos B2B,150000000,COP,2026-01-10,2026-07-09,false,,no_aplica,Laura Gómez Restrepo,Contratos/2026/distribuidora-caribe/CT-2026-002.pdf,2026-01-12,buzon\nCT-2026-004,Logística del Istmo S.A.,155612345,PA,Implementación de sistema de gestión de bodegas (WMS),180000,USD,2026-01-15,2026-10-15,true,cumplimiento;calidad,pendiente,Carlos Ruiz Medina,Contratos/2026/logistica-del-istmo/CT-2026-004.pdf,2026-01-20,buzon\nCT-2026-006,Universidad del Valle del Río,890399001,CO,Fábrica de software para sistema académico,980000000,COP,2026-02-20,2027-02-19,true,cumplimiento;salarios_prestaciones,vigente,Andrés Molina Pardo,Contratos/2026/universidad-del-valle-del-rio/CT-2026-006.pdf,2026-02-24,buzon\nCT-2026-007,Corporación Andina de Servicios S.A.,1790012345001,EC,Servicios de arquitectura de nube y migración,95000,USD,2026-03-01,2027-02-28,false,,no_aplica,Laura Gómez Restrepo,Contratos/2026/corporacion-andina-de-servicios/CT-2026-007.pdf,2026-03-03,buzon\nCT-2026-009,Agroexport Sula S. de R.L.,08019995123456,HN,Soporte de plataforma de trazabilidad,60000,USD,2026-04-01,2026-09-30,true,cumplimiento,vigente,Carlos Ruiz Medina,Contratos/2026/agroexport-sula/CT-2026-009.pdf,2026-04-06,buzon\nCT-2026-011,Minera Los Andes S.A.C.,20512345678,PE,Célula ágil de desarrollo para sistema de operaciones,350000,PEN,2026-05-02,2027-05-01,true,cumplimiento;responsabilidad_civil,vigente,Carlos Ruiz Medina,Contratos/2026/minera-los-andes/CT-2026-011.pdf,2026-05-05,buzon\nCT-2026-012,Clínica San Rafael S.A.,890903456,CO,Mesa de servicio TI nivel 1 y 2,210000000,COP,2026-05-15,2026-11-14,false,,no_aplica,Laura Gómez Restrepo,Contratos/2026/clinica-san-rafael/CT-2026-012.pdf,2026-05-18,buzon\n",
  "commercials": [
    {
      "email": "lgomez@periferia-ficticia.com",
      "nombre": "Laura Gómez Restrepo",
      "region": "Colombia"
    },
    {
      "email": "cruiz@periferia-ficticia.com",
      "nombre": "Carlos Ruiz Medina",
      "region": "Andina y Centroamérica"
    },
    {
      "email": "amolina@periferia-ficticia.com",
      "nombre": "Andrés Molina Pardo",
      "region": "Sector público Colombia"
    }
  ],
  "documents": [
    {
      "correo": {
        "id": "msg-001",
        "de": "lgomez@periferia-ficticia.com",
        "para": "contratos@periferia-ficticia.com",
        "asunto": "Contrato firmado - Industrias Delta - Implementación CRM",
        "fecha": "2026-08-04T09:12:00-05:00",
        "cuerpo": "Hola, adjunto el contrato firmado con Industrias Delta para la implementación del CRM. Requiere póliza de cumplimiento, favor gestionar con el corredor. Gracias, Laura.",
        "adjuntos": [
          "contrato.txt"
        ]
      },
      "archivos": {
        "contrato.txt": "CONTRATO DE PRESTACIÓN DE SERVICIOS No. CT-2026-015\n\nEntre los suscritos, INDUSTRIAS DELTA S.A.S., identificada con NIT 890.900.111-4, con domicilio en Bogotá D.C., representada legalmente por Mauricio Salgado Ríos, quien en adelante se denominará EL CONTRATANTE, y PERIFERIA IT GROUP S.A.S., identificada con NIT 900.123.456-7, con domicilio en Medellín, Colombia, representada legalmente por Roberto Andrade Salazar, quien en adelante se denominará EL CONTRATISTA, se ha celebrado el presente contrato que se regirá por las siguientes cláusulas:\n\nPRIMERA. OBJETO. EL CONTRATISTA se obliga a ejecutar la implementación, parametrización y soporte de la plataforma CRM del CONTRATANTE, incluyendo migración de datos y capacitación a usuarios finales.\n\nSEGUNDA. VALOR. El valor total del presente contrato es de DOSCIENTOS SESENTA Y CINCO MILLONES DE PESOS M/CTE (COP $265.000.000), IVA incluido.\n\nTERCERA. PLAZO. El plazo de ejecución será desde el primero (1) de agosto de 2026 hasta el treinta y uno (31) de julio de 2027.\n\nCUARTA. FORMA DE PAGO. El CONTRATANTE pagará al CONTRATISTA mediante facturas mensuales, dentro de los treinta (30) días calendario siguientes a su radicación.\n\nQUINTA. OBLIGACIONES DEL CONTRATISTA. Ejecutar el objeto con personal idóneo, guardar confidencialidad sobre la información del CONTRATANTE y presentar informes mensuales de avance.\n\nSEXTA. GARANTÍAS. EL CONTRATISTA constituirá a favor del CONTRATANTE una póliza de cumplimiento por el veinte por ciento (20%) del valor del contrato, con vigencia igual al plazo y cuatro (4) meses más, expedida por una compañía de seguros legalmente establecida en Colombia.\n\nSÉPTIMA. CONFIDENCIALIDAD. Las partes se obligan a mantener la confidencialidad de la información intercambiada durante la ejecución del contrato y por cinco (5) años después de su terminación.\n\nPara constancia se firma en Bogotá D.C., a los treinta (30) días del mes de julio de 2026.\n\nEL CONTRATANTE                                   EL CONTRATISTA\nMauricio Salgado Ríos                                    Roberto Andrade Salazar\nIndustrias Delta S.A.S.                                     Periferia IT Group S.A.S.\n"
      }
    },
    {
      "correo": {
        "id": "msg-002",
        "de": "cruiz@periferia-ficticia.com",
        "para": "contratos@periferia-ficticia.com",
        "asunto": "Contrato Corporación Andina - Fábrica de software 2026-2027",
        "fecha": "2026-08-18T16:40:00-05:00",
        "cuerpo": "Equipo, va el contrato firmado con Corporación Andina. Este no pide póliza. Saludos, Carlos.",
        "adjuntos": [
          "contrato.txt"
        ]
      },
      "archivos": {
        "contrato.txt": "CONTRATO DE PRESTACIÓN DE SERVICIOS No. CT-2026-016\n\nEntre los suscritos, CORPORACIÓN ANDINA DE SERVICIOS S.A., identificada con RUC 1790012345001, con domicilio en Quito, Ecuador, representada legalmente por Verónica Paredes Loor, quien en adelante se denominará EL CONTRATANTE, y PERIFERIA IT GROUP S.A.S., identificada con NIT 900.123.456-7, con domicilio en Medellín, Colombia, representada legalmente por Roberto Andrade Salazar, quien en adelante se denominará EL CONTRATISTA, se ha celebrado el presente contrato que se regirá por las siguientes cláusulas:\n\nPRIMERA. OBJETO. EL CONTRATISTA prestará servicios de fábrica de software bajo modalidad de célula dedicada, con un equipo de seis (6) profesionales, para la evolución de las aplicaciones corporativas del CONTRATANTE.\n\nSEGUNDA. VALOR. El valor total del presente contrato es de CIENTO VEINTE MIL DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (USD 120,000.00), más los impuestos de ley.\n\nTERCERA. PLAZO. El plazo de ejecución será de doce (12) meses, desde el quince (15) de agosto de 2026 hasta el catorce (14) de agosto de 2027.\n\nCUARTA. FORMA DE PAGO. El CONTRATANTE pagará al CONTRATISTA mediante facturas mensuales, dentro de los treinta (30) días calendario siguientes a su radicación.\n\nQUINTA. OBLIGACIONES DEL CONTRATISTA. Ejecutar el objeto con personal idóneo, guardar confidencialidad sobre la información del CONTRATANTE y presentar informes mensuales de avance.\n\nSEXTA. CONFIDENCIALIDAD. Las partes se obligan a mantener la confidencialidad de la información intercambiada durante la ejecución del contrato y por cinco (5) años después de su terminación.\n\nPara constancia se firma en Quito, Ecuador, a los doce (12) días del mes de agosto de 2026.\n\nEL CONTRATANTE                                   EL CONTRATISTA\nVerónica Paredes Loor                                    Roberto Andrade Salazar\nCorporación Andina de Servicios S.A.                                     Periferia IT Group S.A.S.\n"
      }
    },
    {
      "correo": {
        "id": "msg-003",
        "de": "cruiz@periferia-ficticia.com",
        "para": "contratos@periferia-ficticia.com",
        "asunto": "Otrosí No. 1 contrato CT-2026-011 Minera Los Andes",
        "fecha": "2026-08-22T11:05:00-05:00",
        "cuerpo": "Adjunto el otrosí firmado que amplía plazo y valor del contrato con Minera Los Andes. Favor actualizar el registro. Carlos.",
        "adjuntos": [
          "otrosi.txt"
        ]
      },
      "archivos": {
        "otrosi.txt": "OTROSÍ No. 1 AL CONTRATO DE PRESTACIÓN DE SERVICIOS No. CT-2026-011\n\nEntre MINERA LOS ANDES S.A.C., identificada con RUC 20512345678, con domicilio en Lima, Perú, representada por Jorge Quispe Huamán (EL CONTRATANTE), y PERIFERIA IT GROUP S.A.S., NIT 900.123.456-7, representada por Roberto Andrade Salazar (EL CONTRATISTA), se acuerda modificar el contrato No. CT-2026-011 suscrito el dos (2) de mayo de 2026, en los siguientes términos:\n\nPRIMERA. Modificar la cláusula TERCERA (PLAZO), la cual quedará así: \"El plazo de ejecución se extiende hasta el primero (1) de noviembre de 2027.\"\n\nSEGUNDA. Modificar la cláusula SEGUNDA (VALOR), la cual quedará así: \"El valor total del contrato será de QUINIENTOS VEINTE MIL SOLES (PEN 520,000.00), incluidos los impuestos de ley.\"\n\nTERCERA. Las demás cláusulas del contrato, incluidas las garantías de cumplimiento y responsabilidad civil, permanecen sin modificación y deberán ampliarse en vigencia conforme al nuevo plazo.\n\nSe firma en Lima, a los veinte (20) días del mes de agosto de 2026.\n\nJorge Quispe Huamán                    Roberto Andrade Salazar\nMinera Los Andes S.A.C.                Periferia IT Group S.A.S.\n"
      }
    },
    {
      "correo": {
        "id": "msg-004",
        "de": "lgomez@periferia-ficticia.com",
        "para": "contratos@periferia-ficticia.com",
        "asunto": "RV: Contrato Clínica San Rafael - Mesa de servicio",
        "fecha": "2026-08-26T08:30:00-05:00",
        "cuerpo": "Reenvío por si no lo tienen, es el contrato de la mesa de servicio de la Clínica que firmamos en mayo. Laura.",
        "adjuntos": [
          "contrato.txt"
        ]
      },
      "archivos": {
        "contrato.txt": "CONTRATO DE PRESTACIÓN DE SERVICIOS No. CT-2026-012\n\nEntre los suscritos, CLÍNICA SAN RAFAEL S.A., identificada con NIT 890.903.456-1, con domicilio en Medellín, representada legalmente por Patricia Londoño Arango, quien en adelante se denominará EL CONTRATANTE, y PERIFERIA IT GROUP S.A.S., identificada con NIT 900.123.456-7, con domicilio en Medellín, Colombia, representada legalmente por Roberto Andrade Salazar, quien en adelante se denominará EL CONTRATISTA, se ha celebrado el presente contrato que se regirá por las siguientes cláusulas:\n\nPRIMERA. OBJETO. EL CONTRATISTA prestará el servicio de mesa de servicio de tecnología en niveles 1 y 2 para los usuarios del CONTRATANTE, en horario 7x24.\n\nSEGUNDA. VALOR. El valor total del presente contrato es de DOSCIENTOS DIEZ MILLONES DE PESOS M/CTE (COP $210.000.000), IVA incluido.\n\nTERCERA. PLAZO. El plazo de ejecución será de seis (6) meses, desde el quince (15) de mayo de 2026 hasta el catorce (14) de noviembre de 2026.\n\nCUARTA. FORMA DE PAGO. El CONTRATANTE pagará al CONTRATISTA mediante facturas mensuales, dentro de los treinta (30) días calendario siguientes a su radicación.\n\nQUINTA. OBLIGACIONES DEL CONTRATISTA. Ejecutar el objeto con personal idóneo, guardar confidencialidad sobre la información del CONTRATANTE y presentar informes mensuales de avance.\n\nSEXTA. CONFIDENCIALIDAD. Las partes se obligan a mantener la confidencialidad de la información intercambiada durante la ejecución del contrato y por cinco (5) años después de su terminación.\n\nPara constancia se firma en Medellín, a los catorce (14) días del mes de mayo de 2026.\n\nEL CONTRATANTE                                   EL CONTRATISTA\nPatricia Londoño Arango                                    Roberto Andrade Salazar\nClínica San Rafael S.A.                                     Periferia IT Group S.A.S.\n"
      }
    },
    {
      "correo": {
        "id": "msg-005",
        "de": "amolina@periferia-ficticia.com",
        "para": "contratos@periferia-ficticia.com",
        "asunto": "Cotización propuesta Universidad - ampliación fábrica",
        "fecha": "2026-08-27T14:15:00-05:00",
        "cuerpo": "Les comparto la cotización que enviamos a la Universidad para la ampliación de la fábrica de software. Aún no hay contrato, es para que la tengan en el radar. Andrés.",
        "adjuntos": [
          "cotizacion.txt"
        ]
      },
      "archivos": {
        "cotizacion.txt": "COTIZACIÓN No. COT-2026-088\nFecha: 27 de agosto de 2026\nCliente: Universidad del Valle del Río\nAtención: Oficina de Tecnología\n\nDescripción: Ampliación de la célula de fábrica de software en dos (2) desarrolladores senior por seis (6) meses.\nValor mensual: COP 32.000.000\nValor total estimado: COP 192.000.000 más IVA\nValidez de la oferta: 30 días calendario.\n\nPeriferia IT Group S.A.S.\n"
      }
    },
    {
      "correo": {
        "id": "msg-006",
        "de": "jperez@periferia-ficticia.com",
        "para": "contratos@periferia-ficticia.com",
        "asunto": "Contrato marco Distribuidora Caribe",
        "fecha": "2026-08-31T17:50:00-05:00",
        "cuerpo": "Buenas tardes, me pidieron enviarles este contrato marco que se firmó con Distribuidora Caribe. Quedo atento. Julián Pérez, practicante comercial.",
        "adjuntos": [
          "contrato.txt"
        ]
      },
      "archivos": {
        "contrato.txt": "CONTRATO MARCO DE PRESTACIÓN DE SERVICIOS No. CM-2026-03\n\nEntre DISTRIBUIDORA CARIBE S.A.S., NIT 800.222.333-9, con domicilio en Barranquilla, representada legalmente por Ernesto Villalba Cano (EL CONTRATANTE), y PERIFERIA IT GROUP S.A.S., NIT 900.123.456-7, representada legalmente por Roberto Andrade Salazar (EL CONTRATISTA), se celebra el presente contrato marco:\n\nPRIMERA. OBJETO. Establecer las condiciones generales bajo las cuales EL CONTRATISTA prestará servicios de desarrollo de software, soporte y consultoría tecnológica, que se concretarán mediante órdenes de servicio suscritas por las partes.\n\nSEGUNDA. VALOR. El presente contrato marco no tiene un valor determinado. El valor de cada servicio será el que se establezca en la respectiva orden de servicio, según las tarifas del Anexo 1.\n\nTERCERA. PLAZO. El presente contrato tendrá una duración de doce (12) meses contados a partir de la fecha de su firma, prorrogables automáticamente por periodos iguales salvo aviso en contrario con treinta (30) días de antelación.\n\nCUARTA. GARANTÍAS. Para cada orden de servicio cuyo valor supere los cien millones de pesos (COP $100.000.000), EL CONTRATISTA constituirá póliza de cumplimiento por el diez por ciento (10%) de su valor.\n\nSe firma en Barranquilla, en el mes de agosto de 2026.\n\nErnesto Villalba Cano                  Roberto Andrade Salazar\nDistribuidora Caribe S.A.S.            Periferia IT Group S.A.S.\n"
      }
    }
  ]
};
