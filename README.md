# WAVY Backend

Backend Node.js para señalización y servicios de WAVY.

## Estado de producción (AWS verificado)

Cuenta: `372714114281`  
Región: `us-east-1`

### Infraestructura activa
- ALB: `wavy-alb` (`wavy-alb-1189004548.us-east-1.elb.amazonaws.com`)
- ECS Cluster: `wavy-cluster`
- ECS Service: `wavy-service` (Fargate, 1 task)
- Task Definition activa: `wavy-backend:1`
- Target Group: `wavy-tg` (`/health`)
- ECR: `wavy-backend`
- DynamoDB:
  - `wavy-waves`
  - `wavy-users`
  - `wavy-tracks`
  - `wavy-backend-cache`
  - `wavy-backend-sessions`
- S3: `wavy-music-372714114281`
- CloudWatch logs:
  - `/ecs/wavy-backend`
  - `/aws/lambda/wavy-stop-service`
- Lambda: `wavy-stop-service`
- EventBridge:
  - `wavy-start-service` (13:00 UTC, L-V)
  - `wavy-stop-service` (21:00 UTC, L-V)

## Endpoints

- API base (HTTPS): `https://wavy-alb-1189004548.us-east-1.elb.amazonaws.com`
- Health: `https://wavy-alb-1189004548.us-east-1.elb.amazonaws.com/health`
- Socket.IO (WSS): `wss://wavy-alb-1189004548.us-east-1.elb.amazonaws.com`

## Desarrollo local

### Requisitos
- Node.js 18+

### Instalación
```bash
npm install
```

### Ejecutar backend local
```bash
npm start
```

Servidor local:
- API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

## Comandos AWS útiles

```bash
aws ecs describe-services --cluster wavy-cluster --services wavy-service --region us-east-1
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:372714114281:targetgroup/wavy-tg/2f0590ac8045354d --region us-east-1
aws logs tail /ecs/wavy-backend --follow --region us-east-1
```

## Notas
- Actualmente no hay EC2 ni RDS para este backend en producción.
- El backend funciona sobre ECS Fargate detrás de ALB con certificado ACM.
