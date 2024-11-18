import { Logger, createLogger, format, transports } from "winston";

export class AppLogger {
	public logger: Logger;
	public readonly label: string;

	constructor(label: string) {
		this.label = label;
		this.initLogger(label);
	}

	private initLogger(label: string) {
		if (this.logger) return;
		if (label.length > 30) throw new Error("Too long label");
		const customFormat = format.combine(format.timestamp(), this.customPrintf());

		const logger = createLogger({
			format: customFormat,
			transports: [new transports.Console()],
			level: "info",
		});

		this.logger = logger.child({ label });
	}

	private customPrintf = () => {
		return format.printf(({ level, message, label, timestamp }: any) => {
			return `${timestamp} | ${level.toLowerCase().padEnd(5)} | ${label.padEnd(20)} | ${message}`;
		});
	};
}
