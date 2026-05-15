import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { User } from "./User";
import { Restaurant } from "./Restaurant";

export enum StaffRole {
  MANAGER = "MANAGER",
  HOST = "HOST",
  WAITER = "WAITER",
  CHEF = "CHEF",
  CUSTOM = "CUSTOM",
}

export enum Permission {
  RESERVATIONS_READ = "RESERVATIONS_READ",
  RESERVATIONS_WRITE = "RESERVATIONS_WRITE",
  FLOOR_PLAN = "FLOOR_PLAN",
  MENU_MANAGE = "MENU_MANAGE",
  SETTINGS_READ = "SETTINGS_READ",
  SETTINGS_WRITE = "SETTINGS_WRITE",
  STAFF_MANAGE = "STAFF_MANAGE",
  REPORTS = "REPORTS",
}

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  [StaffRole.MANAGER]: [
    Permission.RESERVATIONS_READ,
    Permission.RESERVATIONS_WRITE,
    Permission.FLOOR_PLAN,
    Permission.MENU_MANAGE,
    Permission.SETTINGS_READ,
    Permission.SETTINGS_WRITE,
    Permission.REPORTS,
  ],
  [StaffRole.HOST]: [
    Permission.RESERVATIONS_READ,
    Permission.RESERVATIONS_WRITE,
    Permission.SETTINGS_READ,
  ],
  [StaffRole.WAITER]: [
    Permission.RESERVATIONS_READ,
    Permission.RESERVATIONS_WRITE,
  ],
  [StaffRole.CHEF]: [
    Permission.RESERVATIONS_READ,
    Permission.REPORTS,
  ],
  [StaffRole.CUSTOM]: [],
};

@Table({ tableName: "restaurant_staff" })
export class RestaurantStaff extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @Default(StaffRole.CUSTOM)
  @Column(DataType.ENUM(...Object.values(StaffRole)))
  declare role: StaffRole;

  @Column(DataType.JSONB)
  declare permissions: Permission[];

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare invitedBy: string | null;

  @Column(DataType.STRING)
  declare activationToken: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
