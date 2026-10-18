using System;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Diagnostics;

namespace ConcordInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }

    public class InstallerForm : Form
    {
        private ProgressBar progressBar;
        private Label lblTitle;
        private Label lblSubtitle;
        private Label lblStatus;
        private Label lblDetails;
        private Button btnAction;
        private WebClient webClient;

        // IP do servidor Concord
        private string serverUrl = "http://45.184.120.69:3002";
        private string tempZipPath;
        private string installDir;

        public InstallerForm()
        {
            InitializeComponent();

            installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Concord");
            tempZipPath = Path.Combine(Path.GetTempPath(), "concord_setup.zip");

            this.Load += async (s, e) => await StartInstallation();
        }

        private void InitializeComponent()
        {
            this.Text = "Instalador - Concord";
            this.Size = new Size(500, 320);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(30, 31, 34); // Concord Dark
            this.ForeColor = Color.White;

            // Painel Superior com Banner
            Panel topPanel = new Panel();
            topPanel.Dock = DockStyle.Top;
            topPanel.Height = 85;
            topPanel.BackColor = Color.FromArgb(43, 45, 49);

            // Ícone Concord Circular
            Label iconBox = new Label();
            iconBox.Size = new Size(54, 54);
            iconBox.Location = new Point(20, 15);
            iconBox.BackColor = Color.FromArgb(88, 101, 242);
            iconBox.ForeColor = Color.White;
            iconBox.Font = new Font("Arial", 18, FontStyle.Bold);
            iconBox.TextAlign = ContentAlignment.MiddleCenter;
            iconBox.Text = "C";
            topPanel.Controls.Add(iconBox);

            lblTitle = new Label();
            lblTitle.Text = "Concord";
            lblTitle.Font = new Font("Segoe UI", 16, FontStyle.Bold);
            lblTitle.ForeColor = Color.White;
            lblTitle.Location = new Point(88, 16);
            lblTitle.AutoSize = true;
            topPanel.Controls.Add(lblTitle);

            lblSubtitle = new Label();
            lblSubtitle.Text = "Voz com IA DeepFilterNet3 & Multi-Transmissões 60FPS";
            lblSubtitle.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(148, 155, 164);
            lblSubtitle.Location = new Point(90, 48);
            lblSubtitle.AutoSize = true;
            topPanel.Controls.Add(lblSubtitle);

            this.Controls.Add(topPanel);

            // Status da Instalação
            lblStatus = new Label();
            lblStatus.Text = "Iniciando instalador...";
            lblStatus.Font = new Font("Segoe UI", 10, FontStyle.Bold);
            lblStatus.ForeColor = Color.White;
            lblStatus.Location = new Point(25, 105);
            lblStatus.Size = new Size(440, 25);
            this.Controls.Add(lblStatus);

            // Barra de Progresso
            progressBar = new ProgressBar();
            progressBar.Location = new Point(25, 135);
            progressBar.Size = new Size(435, 26);
            progressBar.Style = ProgressBarStyle.Continuous;
            this.Controls.Add(progressBar);

            // Detalhes do Download (MB e %)
            lblDetails = new Label();
            lblDetails.Text = "Conectando ao servidor Concord...";
            lblDetails.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblDetails.ForeColor = Color.FromArgb(148, 155, 164);
            lblDetails.Location = new Point(25, 170);
            lblDetails.Size = new Size(435, 20);
            this.Controls.Add(lblDetails);

            // Botão de Ação / Cancelar
            btnAction = new Button();
            btnAction.Text = "Cancelar";
            btnAction.Size = new Size(110, 34);
            btnAction.Location = new Point(350, 220);
            btnAction.BackColor = Color.FromArgb(43, 45, 49);
            btnAction.FlatStyle = FlatStyle.Flat;
            btnAction.FlatAppearance.BorderColor = Color.FromArgb(88, 101, 242);
            btnAction.ForeColor = Color.White;
            btnAction.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            btnAction.Click += (s, e) => Application.Exit();
            this.Controls.Add(btnAction);
        }

        private async Task StartInstallation()
        {
            try
            {
                lblStatus.Text = "Conectando ao servidor...";
                lblDetails.Text = "Baixando o pacote do Concord de " + serverUrl + "...";

                string downloadUrl = serverUrl.TrimEnd('/') + "/download/app.zip";

                // Suporte a TLS moderno
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;

                using (webClient = new WebClient())
                {
                    webClient.DownloadProgressChanged += (s, e) =>
                    {
                        progressBar.Value = e.ProgressPercentage;
                        double receivedMB = (double)e.BytesReceived / 1024 / 1024;
                        double totalMB = (double)e.TotalBytesToReceive / 1024 / 1024;
                        lblStatus.Text = string.Format("Baixando aplicativo: {0}%", e.ProgressPercentage);
                        lblDetails.Text = string.Format("{0:0.0} MB de {1:0.0} MB baixados...", receivedMB, totalMB);
                    };

                    webClient.DownloadFileCompleted += async (s, e) =>
                    {
                        if (e.Error != null)
                        {
                            HandleError(e.Error);
                            return;
                        }

                        if (e.Cancelled)
                        {
                            lblStatus.Text = "Download cancelado.";
                            return;
                        }

                        await ExtractAndSetup();
                    };

                    await webClient.DownloadFileTaskAsync(new Uri(downloadUrl), tempZipPath);
                }
            }
            catch (Exception ex)
            {
                HandleError(ex);
            }
        }

        private async Task ExtractAndSetup()
        {
            lblStatus.Text = "Instalando aplicativo...";
            lblDetails.Text = "Extraindo arquivos do Concord...";
            progressBar.Style = ProgressBarStyle.Marquee;

            await Task.Run(() =>
            {
                try
                {
                    // Fecha processos antigos se estiverem abertos
                    foreach (var name in new[] { "Concord", "Discord Clone" })
                    {
                        foreach (var process in Process.GetProcessesByName(name))
                        {
                            try { process.Kill(); } catch { }
                        }
                    }

                    if (Directory.Exists(installDir))
                    {
                        try { Directory.Delete(installDir, true); } catch { }
                    }
                    Directory.CreateDirectory(installDir);

                    // Extrair arquivo zip
                    ZipFile.ExtractToDirectory(tempZipPath, installDir);

                    // Determinar executável alvo (Concord.exe ou Discord Clone.exe)
                    string targetExe = Path.Combine(installDir, "Concord.exe");
                    string oldExe = Path.Combine(installDir, "Discord Clone.exe");
                    if (!File.Exists(targetExe) && File.Exists(oldExe))
                    {
                        try { File.Copy(oldExe, targetExe, true); } catch { targetExe = oldExe; }
                    }

                    // Criar Atalho na Área de Trabalho
                    string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    string shortcutDesktop = Path.Combine(desktopPath, "Concord.lnk");
                    CreateShortcut(shortcutDesktop, targetExe, installDir, "Concord - Voz IA & Transmissão");

                    // Criar Atalho no Menu Iniciar
                    string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Concord.lnk");
                    CreateShortcut(startMenuPath, targetExe, installDir, "Concord - Voz IA & Transmissão");

                    // Limpa zip temporário
                    if (File.Exists(tempZipPath))
                    {
                        try { File.Delete(tempZipPath); } catch { }
                    }
                }
                catch (Exception ex)
                {
                    this.Invoke(new Action(() => HandleError(ex)));
                }
            });

            lblStatus.Text = "Instalação concluída com sucesso!";
            lblDetails.Text = "Iniciando o Concord agora...";
            progressBar.Style = ProgressBarStyle.Continuous;
            progressBar.Value = 100;

            await Task.Delay(1000);

            // Iniciar o aplicativo
            string exePath = Path.Combine(installDir, "Concord.exe");
            if (!File.Exists(exePath)) exePath = Path.Combine(installDir, "Discord Clone.exe");

            if (File.Exists(exePath))
            {
                Process.Start(new ProcessStartInfo(exePath)
                {
                    WorkingDirectory = installDir
                });
            }

            Application.Exit();
        }

        private void CreateShortcut(string shortcutPath, string targetPath, string workingDirectory, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = workingDirectory;
                shortcut.Description = description;
                shortcut.Save();
            }
            catch
            {
                // Se falhar a criação do atalho por permissão, continua
            }
        }

        private void HandleError(Exception ex)
        {
            progressBar.Style = ProgressBarStyle.Continuous;
            progressBar.Value = 0;
            lblStatus.Text = "Erro ao conectar ao servidor!";
            lblDetails.Text = "Não foi possível baixar de " + serverUrl;

            DialogResult res = MessageBox.Show(
                "Não foi possível baixar os arquivos do servidor em:\n" + serverUrl + "\n\n" +
                "Verifique se o servidor Concord está online na porta 3002.\n\n" +
                "Deseja tentar novamente?",
                "Erro de Conexão - Concord",
                MessageBoxButtons.RetryCancel,
                MessageBoxIcon.Warning
            );

            if (res == DialogResult.Retry)
            {
                StartInstallation();
            }
            else
            {
                btnAction.Text = "Fechar";
            }
        }
    }
}
