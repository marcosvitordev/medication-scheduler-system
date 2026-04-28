"use client";

import { useState } from "react";
import {
  Building2,
  User,
  Database,
  Server,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SettingsContent() {
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/patients");
      if (res.ok) {
        setConnectionStatus("success");
      } else {
        setConnectionStatus("error");
      }
    } catch {
      setConnectionStatus("error");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informacoes da Empresa
          </CardTitle>
          <CardDescription>
            Dados exibidos no cabecalho dos documentos gerados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome da Empresa"
              id="companyName"
              placeholder="AT Farma"
              defaultValue="AT Farma"
            />
            <Input
              label="CNPJ"
              id="cnpj"
              placeholder="12.345.678/0001-90"
              defaultValue="12.345.678/0001-90"
            />
            <Input
              label="Telefone"
              id="phone"
              placeholder="(00) 0000-0000"
            />
            <Input
              label="Email"
              id="email"
              type="email"
              placeholder="contato@empresa.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pharmacist Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Farmaceutico Responsavel
          </CardTitle>
          <CardDescription>
            Informacoes do farmaceutico responsavel tecnico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome Completo"
              id="pharmacistName"
              placeholder="Dr. Joao Silva"
            />
            <Input
              label="CRF"
              id="crf"
              placeholder="CRF-XX 00000"
            />
          </div>
        </CardContent>
      </Card>

      {/* API Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Conexao com o Backend
          </CardTitle>
          <CardDescription>
            Teste a conexao com o servidor de backend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              label="URL do Backend"
              id="backendUrl"
              placeholder="http://localhost:3001"
              defaultValue={process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"}
              className="flex-1"
            />
            <div className="pt-6">
              <Button
                variant="secondary"
                onClick={testConnection}
                disabled={isTesting}
              >
                {isTesting ? "Testando..." : "Testar Conexao"}
              </Button>
            </div>
          </div>

          {connectionStatus !== "idle" && (
            <div
              className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                connectionStatus === "success"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {connectionStatus === "success" ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Conexao estabelecida com sucesso!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Falha na conexao. Verifique se o backend esta rodando.
                  </span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Database Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Status do Sistema
          </CardTitle>
          <CardDescription>
            Informacoes sobre o estado atual do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Banco de Dados
                  </p>
                  <p className="text-xs text-muted-foreground">PostgreSQL</p>
                </div>
              </div>
              <Badge variant="success">Conectado</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    API Backend
                  </p>
                  <p className="text-xs text-muted-foreground">NestJS</p>
                </div>
              </div>
              <Badge variant="success">Online</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button>Salvar Configuracoes</Button>
      </div>
    </div>
  );
}
