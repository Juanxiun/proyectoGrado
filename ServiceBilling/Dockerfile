FROM denoland/deno:2.9.7

WORKDIR /app

COPY deno.json deno.lock* ./
RUN deno install --frozen=false

COPY . .

EXPOSE 8886

CMD ["deno", "task", "dev"]
