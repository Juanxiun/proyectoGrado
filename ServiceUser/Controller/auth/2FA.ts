import send from "../../config/send.conf.ts";

export async function EnviarEmial(to: string) {
  const { data, error } = await send.emails.send({
    from: "juanxiuxd@gmail.com",
    to: to,
    subject: "Autenticacion 2FA",
    html: "<p>HOLA SU CODIGO ES 123456</p>",
  });
  if (error) {
    console.error("Error al enviar:", error);
  } else {
    console.log("Correo enviado:", data?.id);
  }
}

export async function ValidarCodigo(cod: number, val: number){
    if(cod == val){
        
    }
}