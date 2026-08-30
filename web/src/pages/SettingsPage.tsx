import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, api, type User } from "../api";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThemeMode } from "../hooks/use-theme";
import { LanguageSwitcher } from "../i18n/LanguageSwitcher";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { TokensPage } from "./TokensPage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function fallback(err: unknown, message: string): string {
  return err instanceof ApiError ? err.message : message;
}

export function SettingsPage(props: {
  user: User;
  themeMode: ThemeMode;
  onThemeMode: (mode: ThemeMode) => void;
  onLogout: () => void;
  onUserUpdated: (user: User) => void;
  onLoggedOut: () => void;
}) {
  const { t } = useTranslation();

  // 资料
  const [username, setUsername] = useState(props.user.username);
  const [displayName, setDisplayName] = useState(props.user.displayName ?? "");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  // 密码
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  // 注销
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const passwordMismatch = confirmPassword !== "" && confirmPassword !== newPassword;

  async function saveProfile() {
    setProfileError("");
    setProfileSaved(false);
    setProfileBusy(true);
    try {
      const body: { username?: string; displayName?: string } = {};
      const trimmedUsername = username.trim();
      if (trimmedUsername !== props.user.username) body.username = trimmedUsername;
      if ((props.user.displayName ?? "") !== displayName) body.displayName = displayName;
      const updated = await api.updateProfile(body);
      props.onUserUpdated(updated);
      setProfileSaved(true);
    } catch (err) {
      setProfileError(fallback(err, t("common.requestFailed")));
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword() {
    setPasswordError("");
    setPasswordSaved(false);
    setPasswordBusy(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(fallback(err, t("common.operationFailed")));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteError("");
    setDeleteBusy(true);
    try {
      await api.deleteAccount(deletePassword);
      setConfirmOpen(false);
      props.onLoggedOut();
    } catch (err) {
      setDeleteError(fallback(err, t("common.operationFailed")));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <PageContainer size="default">
      <Tabs defaultValue="account">
        <TabsList className="max-w-md">
          <TabsTrigger value="general">{t("settings.tabGeneral")}</TabsTrigger>
          <TabsTrigger value="account">{t("settings.tabAccount")}</TabsTrigger>
          <TabsTrigger value="tokens">{t("settings.tabTokens")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="max-w-md space-y-2">
                <Label>{t("settings.language")}</Label>
                <LanguageSwitcher />
              </div>
              <div className="max-w-md space-y-2">
                <Label>{t("settings.theme")}</Label>
                <ThemeSwitcher mode={props.themeMode} onMode={props.onThemeMode} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-4 space-y-6">
          {/* 资料 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.profile")}</CardTitle>
            </CardHeader>
            <CardContent className="max-w-md space-y-3">
            <div className="space-y-2">
              <Label htmlFor="settings-username">{t("settings.username")}</Label>
              <Input
                id="settings-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-display-name">{t("settings.displayName")}</Label>
              <Input
                id="settings-display-name"
                value={displayName}
                placeholder={t("settings.displayNamePlaceholder")}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            {profileSaved ? (
              <p className="text-sm text-muted-foreground">{t("settings.saved")}</p>
            ) : null}
            {profileError ? <p className="text-sm text-destructive">{profileError}</p> : null}
            <Button
              type="button"
              variant="outline"
              disabled={
                profileBusy ||
                (username.trim() === props.user.username &&
                  (props.user.displayName ?? "") === displayName)
              }
              onClick={() => void saveProfile()}
            >
              {t("settings.save")}
            </Button>
            </CardContent>
          </Card>

          {/* 修改密码 */}
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.changePassword")}</CardTitle>
            </CardHeader>
            <CardContent className="max-w-md space-y-3">
            <div className="space-y-2">
              <Label htmlFor="settings-current-password">{t("settings.currentPassword")}</Label>
              <Input
                id="settings-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-new-password">{t("settings.newPassword")}</Label>
              <Input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-confirm-password">{t("settings.confirmPassword")}</Label>
              <Input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {passwordMismatch ? (
              <p className="text-sm text-destructive">{t("settings.passwordMismatch")}</p>
            ) : null}
            {passwordSaved ? (
              <p className="text-sm text-muted-foreground">{t("settings.passwordChanged")}</p>
            ) : null}
            {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
            <Button
              type="button"
              variant="outline"
              disabled={
                passwordBusy ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                passwordMismatch
              }
              onClick={() => void savePassword()}
            >
              {t("settings.changePasswordButton")}
            </Button>
            </CardContent>
          </Card>

          {/* 危险区：退出登录 + 注销账户 */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">{t("settings.dangerZone")}</CardTitle>
            </CardHeader>
            <CardContent className="max-w-md space-y-3">
            <Button type="button" variant="outline" onClick={props.onLogout}>
              {t("settings.logout")}
            </Button>
            <div className="space-y-3 border-t pt-3">
            <p className="text-sm text-muted-foreground">{t("settings.deleteDescription")}</p>
            {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeletePassword("");
                setDeleteError("");
                setConfirmOpen(true);
              }}
            >
              {t("settings.deleteAccount")}
            </Button>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="mt-4">
          <TokensPage />
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.deleteDialog.title")}</DialogTitle>
            <DialogDescription>{t("settings.deleteDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="settings-delete-password">{t("settings.password")}</Label>
            <Input
              id="settings-delete-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={deleteBusy}
            >
              {t("settings.deleteDialog.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deletePassword || deleteBusy}
              onClick={() => void deleteAccount()}
            >
              {t("settings.deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}